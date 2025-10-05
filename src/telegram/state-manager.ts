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

    setState(chatId: number, state: UserState) {
        this.userStates[chatId] = state;
    }

    getState(chatId: number): UserState {
        return this.userStates[chatId] || "idle";
    }

    setUser(chatId: number, user: User) {
        this.users.set(chatId, user);
        this.userStates[chatId] = "configured";
    }

    getUser(chatId: number): User | undefined {
        return this.users.get(chatId);
    }

    removeUser(chatId: number) {
        this.users.delete(chatId);
        this.userStates[chatId] = "idle";
    }

    setTempData(chatId: number, data: string) {
        this.tempData[chatId] = data;
    }

    getTempData(chatId: number): string | undefined {
        return this.tempData[chatId];
    }

    clearTempData(chatId: number) {
        delete this.tempData[chatId];
    }

    setTempIssueData(chatId: number, data: TempYouTrackIssue) {
        this.tempIssueData[chatId] = data;
    }

    getTempIssueData(chatId: number): TempYouTrackIssue | undefined {
        return this.tempIssueData[chatId];
    }

    updateTempIssueData(chatId: number, updates: Partial<TempYouTrackIssue>) {
        if (!this.tempIssueData[chatId]) {
            this.tempIssueData[chatId] = {};
        }
        this.tempIssueData[chatId] = { ...this.tempIssueData[chatId], ...updates };
    }

    clearTempIssueData(chatId: number) {
        delete this.tempIssueData[chatId];
    }

    getAllUsers(): Map<number, User> {
        return this.users;
    }
}