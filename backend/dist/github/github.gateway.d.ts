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
export declare class GithubGateway {
    server: Server;
    private roomStates;
    castGithubEventToRoom(githubEvent: GithubEventData, roomId: string): void;
    private updateRoomState;
    getRoomState(roomId: string): RoomGithubState;
}
