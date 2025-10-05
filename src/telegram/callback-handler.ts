import { TelegramAPI } from "./telegram-api";
import { StateManager } from "./state-manager";
import { YouTrackClient } from "../youtrack/youtrack-client";

export class CallbackHandler {
    private api: TelegramAPI;
    private stateManager: StateManager;
    private yt: YouTrackClient;

    constructor(api: TelegramAPI, stateManager: StateManager, yt: YouTrackClient) {
        this.api = api;
        this.stateManager = stateManager;
        this.yt = yt;
    }

    async handleCallbackQuery(callbackQuery: any) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        if (data.startsWith('project_') && this.stateManager.getState(chatId) === 'awaiting_project_selection') {
            await this.handleProjectSelection(callbackQuery, chatId, messageId, data);
        }
        else if (data === 'cancel_create') {
            await this.handleCancelCreate(callbackQuery, chatId, messageId);
        }
    }

    private async handleProjectSelection(callbackQuery: any, chatId: number, messageId: number, data: string) {
        const projectId = data.replace('project_', '');
        
        this.stateManager.updateTempIssueData(chatId, { projectId: projectId });

        const user = this.stateManager.getUser(chatId);
        if (!user) return;

        const projects = await this.yt.getProjects(user.youtrack_url, user.youtrack_token);
        const selectedProject = projects.find(p => p.id === projectId);

        await this.api.answerCallbackQuery(
            callbackQuery.id,
            `✅ Selected: ${selectedProject?.name || projectId}`
        );

        await this.api.editMessageText(
            chatId,
            messageId,
            `✅ Project selected: **${selectedProject?.name || projectId}**`,
            'Markdown'
        );

        this.stateManager.setState(chatId, "awaiting_title");
        await this.api.sendMessage(chatId, "📝 Please insert the Issue title:");
    }

    private async handleCancelCreate(callbackQuery: any, chatId: number, messageId: number) {
        await this.api.answerCallbackQuery(callbackQuery.id);

        await this.api.editMessageText(
            chatId,
            messageId,
            "❌ Operation cancelled."
        );

        this.stateManager.setState(chatId, "configured");
        this.stateManager.clearTempIssueData(chatId);
    }
}