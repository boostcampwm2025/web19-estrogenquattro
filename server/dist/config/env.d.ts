export interface Config {
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    JWT_SECRET: string;
    PORT: number;
    FRONTEND_URL: string;
    GITHUB_CALLBACK_URL: string;
    NODE_ENV: 'development' | 'production' | 'test';
}
export declare const config: Config;
//# sourceMappingURL=env.d.ts.map