import { type Express, type Request, type Response } from 'express';
declare global {
    namespace Express {
        interface User {
            githubId: string;
            username: string;
            avatarUrl: string;
            accessToken: string;
        }
    }
}
export declare function setupAuthRoutes(app: Express): void;
export declare function authenticateJWT(req: Request, res: Response, next: () => void): void;
//# sourceMappingURL=auth.d.ts.map