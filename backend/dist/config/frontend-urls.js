"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFrontendUrls = getFrontendUrls;
function getFrontendUrls(configService) {
    const raw = configService.getOrThrow('FRONTEND_URL').trim();
    if (!raw) {
        throw new Error('FRONTEND_URL must be a non-empty URL');
    }
    if (raw.includes(',')) {
        throw new Error('FRONTEND_URL must be a single URL');
    }
    return [raw];
}
//# sourceMappingURL=frontend-urls.js.map