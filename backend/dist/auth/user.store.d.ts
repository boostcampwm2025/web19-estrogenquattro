import { User } from './user.interface';
export declare class UserStore {
    private users;
    findByGithubId(githubId: string): User | undefined;
    save(user: User): User;
    findOrCreate(user: User): User;
}
