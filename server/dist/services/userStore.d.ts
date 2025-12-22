import type { User } from './types.js';
declare class UserStore {
    private users;
    findByGithubId(githubId: string): User | undefined;
    save(user: User): User;
    findOrCreate(user: User): User;
}
export declare const userStore: UserStore;
export {};
//# sourceMappingURL=userStore.d.ts.map