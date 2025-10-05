import { User } from "../models/db";
import { TempYouTrackIssue } from "../models/youtrack";

export type UserState = "idle" | "awaiting_url" | "awaiting_token" | "configured" | "awaiting_project_selection" | "awaiting_title" | "awaiting_desc";

export class StateManager {
    private userStates: Record<number, UserState>;
    private users: Map<number, User>;
    private tempData: Record<number, string>;
    private tempIssueData: Record<number, TempYouTrackIssue>;
    
    constructor() {
        this.userStates = {};
        this.users = new Map<number, User>();
        this.tempData = {};
        this.tempIssueData = {};
    }

    public setState(chatId: number, state: UserState) {
        this.userStates[chatId] = state;
    }

    public getState(chatId: number): UserState {
        return this.userStates[chatId] || "idle";
    }

    public setUser(chatId: number, user: User) {
        this.users.set(chatId, user);
        this.userStates[chatId] = "configured";
    }

    public getUser(chatId: number): User | undefined {
        return this.users.get(chatId);
    }

    public removeUser(chatId: number) {
        this.users.delete(chatId);
        this.userStates[chatId] = "idle";
    }

    public setTempData(chatId: number, data: string) {
        this.tempData[chatId] = data;
    }

    public getTempData(chatId: number): string | undefined {
        return this.tempData[chatId];
    }

    public clearTempData(chatId: number) {
        delete this.tempData[chatId];
    }

    public setTempIssueData(chatId: number, data: TempYouTrackIssue) {
        this.tempIssueData[chatId] = data;
    }

    public getTempIssueData(chatId: number): TempYouTrackIssue | undefined {
        return this.tempIssueData[chatId];
    }

    public updateTempIssueData(chatId: number, updates: Partial<TempYouTrackIssue>) {
        if (!this.tempIssueData[chatId]) {
            this.tempIssueData[chatId] = {};
        }
        this.tempIssueData[chatId] = { ...this.tempIssueData[chatId], ...updates };
    }

    public clearTempIssueData(chatId: number) {
        delete this.tempIssueData[chatId];
    }

    public getAllUsers(): Map<number, User> {
        return this.users;
    }
}