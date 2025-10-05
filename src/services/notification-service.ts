import { TelegramAPI } from "../telegram/telegram-api";
import { StateManager } from "../telegram/state-manager";
import { YouTrackClient } from "../youtrack/youtrack-client";
import { TelegramFormatter } from "../youtrack/telegram-formatter";


export class NotificationService {
    private api: TelegramAPI;
    private stateManager: StateManager;
    private yt: YouTrackClient;
    private pollInterval: number;
    private lastPollTimestamps: Record<number, number>;
    private formatter: TelegramFormatter;
    constructor(api: TelegramAPI, stateManager: StateManager, yt: YouTrackClient, pollInterval = 30000) {
        this.api = api;
        this.stateManager = stateManager;
        this.yt = yt;
        this.pollInterval = pollInterval;
        this.lastPollTimestamps = {};
        this.formatter = new TelegramFormatter();
    }

    public startPollingForUser(chatId: number) {
        const user = this.stateManager.getUser(chatId);
        if (!user) return;

        if (!this.lastPollTimestamps[chatId]) {
            this.lastPollTimestamps[chatId] = new Date().getTime();
        }

        const poll = async () => {
            const since = this.lastPollTimestamps[chatId];
            const notifications = await this.yt.getNotifications(user.youtrack_url, user.youtrack_token, since);
            if (!notifications) return;
            notifications.sort((a, b) => a.timestamp - b.timestamp);
            for (const n of notifications) {
                await this.api.sendMessage(
                    chatId,
                    this.formatter.formatNotification(n),
                    "Markdown"
                );
                this.lastPollTimestamps[chatId] = n.timestamp + 1;
            }

            if (this.stateManager.getState(chatId) === "configured") {
                setTimeout(poll, this.pollInterval);
            }
        };
        console.log("Started notification polling for user:", chatId);
        poll();
    }
}
