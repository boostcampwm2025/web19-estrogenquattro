import { Server } from 'socket.io';
export interface GithubEventData {
    username: string;
    pushCount: number;
    pullRequestCount: number;
}
export interface RoomGithubState {
    progress: number;
    contributions: Record<string, number>;
}
interface PlayerInfo {
    socketId: string;
    userId: string;
    username: string;
    roomId: string;
    x: number;
    y: number;
}
export declare function getRoomState(roomId: string): RoomGithubState;
export declare function updateRoomState(roomId: string, event: GithubEventData): void;
export declare function castGithubEventToRoom(io: Server, githubEvent: GithubEventData, roomId: string): void;
export declare function getPlayers(): Map<string, PlayerInfo>;
export declare function setupSocketHandlers(io: Server): void;
export {};
//# sourceMappingURL=index.d.ts.map