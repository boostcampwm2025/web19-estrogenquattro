import { Router } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { userStore } from '../services/userStore.js';
import { logger } from '../config/logger.js';
export function setupAuthRoutes(app) {
    // GitHub OAuth 전략 설정
    passport.use(new GitHubStrategy({
        clientID: config.GITHUB_CLIENT_ID,
        clientSecret: config.GITHUB_CLIENT_SECRET,
        callbackURL: config.GITHUB_CALLBACK_URL,
        scope: ['repo'], // private repo 활동 감지를 위한 권한
    }, (accessToken, _refreshToken, profile, done) => {
        const username = (profile.username && profile.username.trim()) ||
            (profile.displayName && profile.displayName.trim()) ||
            `github-${profile.id}`;
        logger.info(`GitHub OAuth validated - username: ${username}`);
        const user = userStore.findOrCreate({
            githubId: profile.id,
            username,
            avatarUrl: profile.photos?.[0]?.value || '',
            accessToken,
        });
        logger.info(`User stored/found - username: ${user.username}`);
        done(null, user);
    }));
    const router = Router();
    // GitHub OAuth 시작
    router.get('/github', passport.authenticate('github', { session: false }));
    // GitHub OAuth 콜백
    router.get('/github/callback', passport.authenticate('github', {
        session: false,
        failureRedirect: '/login',
    }), (req, res) => {
        const user = req.user;
        logger.info(`GitHub callback - username: ${user.username}`);
        const token = jwt.sign({ sub: user.githubId, username: user.username }, config.JWT_SECRET, { expiresIn: '1d' });
        logger.info(`JWT token generated for user: ${user.username}`);
        const cookieOptions = {
            httpOnly: true,
            secure: config.FRONTEND_URL.startsWith('https://'),
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 1일
            path: '/',
        };
        logger.info(`Setting cookie with options: ${JSON.stringify(cookieOptions)}`);
        res.cookie('access_token', token, cookieOptions);
        logger.info(`Redirecting to: ${config.FRONTEND_URL}/auth/callback`);
        res.redirect(`${config.FRONTEND_URL}/auth/callback`);
    });
    // 유저 정보 조회
    router.get('/me', authenticateJWT, (req, res) => {
        const user = req.user;
        const userInfo = {
            githubId: user.githubId,
            username: user.username,
            avatarUrl: user.avatarUrl,
        };
        logger.info(`/me called - username: ${userInfo.username}`);
        res.json(userInfo);
    });
    // 로그아웃
    router.get('/logout', (_req, res) => {
        res.clearCookie('access_token');
        res.redirect(config.FRONTEND_URL);
    });
    app.use('/auth', router);
}
// JWT 인증 미들웨어
export function authenticateJWT(req, res, next) {
    const token = req.cookies?.access_token;
    if (!token) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        const payload = jwt.verify(token, config.JWT_SECRET);
        const user = userStore.findByGithubId(payload.sub);
        if (!user) {
            res.status(401).json({ message: 'User not found' });
            return;
        }
        req.user = user;
        next();
    }
    catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}
//# sourceMappingURL=auth.js.map