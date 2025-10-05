import { TelegramAPI } from "./telegram-api";
import { StateManager } from "./state-manager";
import { DatabaseController } from "../config/db";
import { YouTrackClient } from "../youtrack/youtrack-client";

export class MessageHandler {
    private api: TelegramAPI;
    private stateManager: StateManager;
    private db: DatabaseController;
    private yt: YouTrackClient;

    constructor(api: TelegramAPI, stateManager: StateManager, db: DatabaseController, yt: YouTrackClient) {
        this.api = api;
        this.stateManager = stateManager;
        this.db = db;
        this.yt = yt;
    }

    async handleMessage(chatId: number, text: string) {
        const state = this.stateManager.getState(chatId);

        if (state === "awaiting_url") {
            await this.handleAwaitingUrl(chatId, text);
        } else if (state === "awaiting_token") {
            await this.handleAwaitingToken(chatId, text);
        } else if (state == "awaiting_title") {
            await this.handleAwaitingTitle(chatId, text);
        } else if (state == "awaiting_desc") {
            await this.handleAwaitingDesc(chatId, text);
        }
    }

    private fixUrl(url: string): string {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        if (url.endsWith("/")) {
            url = url.slice(0, -1);
        }
        return url + "/api";
    }

    private async handleAwaitingUrl(chatId: number, text: string) {
        this.stateManager.setTempData(chatId, this.fixUrl(text));
        this.stateManager.setState(chatId, "awaiting_token");
        await this.api.sendMessage(chatId, "Perfect! Now insert your YouTrack Token:");
    }

    private async handleAwaitingToken(chatId: number, text: string) {
        const token = text; 
        let url = this.stateManager.getTempData(chatId);
        
        if(!url || !await this.yt.validateToken(url, token)) {
            await this.api.sendMessage(chatId, "❌ Invalid YouTrack URL or Token. Please try /setup again.");
            this.stateManager.setState(chatId, "idle");
            return;
        }

        const user = await this.db.addUser(chatId, url, token);
        this.stateManager.clearTempData(chatId);
        
        if(!user) {
            await this.api.sendMessage(chatId, "❌ There was an error saving your configuration. Please try /setup again.");
            this.stateManager.setState(chatId, "idle");          
            return;
        }
        
        this.stateManager.setUser(chatId, user);
        this.stateManager.setState(chatId, "configured");
        await this.api.sendMessage(chatId, "✅ Configuration has been completed successfully!");
    }

    private async handleAwaitingTitle(chatId: number, text: string) {
        const title = text.trim();
        
        if (title.length === 0) {
            await this.api.sendMessage(chatId, "❌ Title cannot be empty. Please try again:");
            return;
        }
        
        this.stateManager.updateTempIssueData(chatId, { summary: title });
        
        this.stateManager.setState(chatId, "awaiting_desc");
        await this.api.sendMessage(chatId, "📄 Please insert the Issue description (or send /skip to create without description):");
    }

    private async handleAwaitingDesc(chatId: number, text: string) {
        const user = this.stateManager.getUser(chatId);
        const tempIssue = this.stateManager.getTempIssueData(chatId);
        
        if(!user || !tempIssue) {
            await this.api.sendMessage(chatId, "❌ There was an error while creating a new Issue, please try again.");
            this.stateManager.setState(chatId, "configured");
            return;
        }
        
        const description = text.trim();
        this.stateManager.updateTempIssueData(chatId, { 
            description: description.length > 0 ? description : undefined 
        });

        const updatedTempIssue = this.stateManager.getTempIssueData(chatId);

        const issue = {
            project: {id: updatedTempIssue!.projectId!},
            summary: updatedTempIssue!.summary!,
            description: updatedTempIssue!.description
        };

        const createdIssue = await this.yt.createIssue(user.youtrack_url, user.youtrack_token, issue);
        
        if(!createdIssue) {
            await this.api.sendMessage(chatId, "❌ There was an error while creating a new Issue, please try again.");
            this.stateManager.setState(chatId, "configured");
            this.stateManager.clearTempIssueData(chatId);
            return;
        }

        await this.api.sendMessage(
            chatId, 
            `✅ Issue created successfully! `,
        );
        
        this.stateManager.setState(chatId, "configured");
        this.stateManager.clearTempIssueData(chatId);
    }
}