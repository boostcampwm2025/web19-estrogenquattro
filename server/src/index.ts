import express, { type Express } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { setupAuthRoutes } from './routes/auth.js';
import { setupSocketHandlers } from './socket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const httpServer = createServer(app);

// Socket.io 설정
const io = new Server(httpServer, {
  cors: {
    origin: config.FRONTEND_URL,
    credentials: true,
  },
});

// 미들웨어
app.use(cookieParser());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(passport.initialize());

// 헬스체크 엔드포인트
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GitHub 프로필 이미지 프록시
app.get('/api/github-profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const githubUrl = `https://github.com/${username}.png`;
    const response = await fetch(githubUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      res.status(response.status).send(`GitHub Error: ${response.status}`);
      return;
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'image/png';

    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    });

    res.send(Buffer.from(imageBuffer));
  } catch (error) {
    logger.error('GitHub Profile Proxy Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 인증 라우트
setupAuthRoutes(app);

// Socket.io 핸들러
setupSocketHandlers(io);

// 정적 파일 서빙 (프로덕션)
if (config.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));

  // SPA 폴백 (Express 5에서는 *path 문법 사용)
  // 백엔드 API 경로만 제외 (/auth/github, /auth/me, /auth/logout, /api/*)
  app.get('/{*path}', (req, res, next) => {
    const backendPaths = ['/auth/github', '/auth/me', '/auth/logout', '/api/', '/health'];
    const isBackendPath = backendPaths.some(p => req.path.startsWith(p));
    if (isBackendPath) {
      return next();
    }
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// 서버 시작
httpServer.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`Frontend URL: ${config.FRONTEND_URL}`);
});

export { app, io };
