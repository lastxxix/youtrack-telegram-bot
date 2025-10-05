import { TelegramAPI } from "./telegram-api";
import { StateManager } from "./state-manager";
import { DatabaseController } from "../config/db";
import { YouTrackClient } from "../youtrack/youtrack-client";
import { NotificationService } from "../services/notification-service";

export class CommandHandler {
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

    public async handleCommand(chatId: number, command: string) {
        switch (command.split(" ")[0]) {
            case "/start":
                await this.handleStart(chatId);
                break;
            case "/setup":
                await this.handleSetup(chatId);
                break;
            case "/reset":
                await this.handleReset(chatId);
                break;
            case "/list":
                await this.handleList(chatId);
                break;
            case "/create":
                await this.handleCreate(chatId);
                break;
            case "/skip":
                await this.handleSkip(chatId);
                break;
            default:
                await this.api.sendMessage(chatId, "Unknown command, use /help to see available commands.");
        }
    }

    private async handleStart(chatId: number) {
        await this.api.sendMessage(chatId, 
            `👋 Welcome to the YouTrack Telegram Bot!\n\n` +
            `I'm here to help you interact with YouTrack from Telegram.\n` +
            `To get started, type /setup to configure your YouTrack URL and API token.\n\n` +
            `If you need help at any time, use /help to see the available commands.`
        );
    }

    private async handleSetup(chatId: number) {
        if(this.stateManager.getState(chatId) == "configured"){
            await this.api.sendMessage(chatId, "❌ Your YouTrack connection is already configured. To remove all the configurations use /reset");
            return;
        }
        this.stateManager.setState(chatId, "awaiting_url");
        await this.api.sendMessage(
            chatId,
            "Please insert YouTrack instance URL (e.g. https://instance.youtrack.cloud):",
            "Markdown"
        );
    }

    private async handleReset(chatId: number) {
        if(this.stateManager.getState(chatId) != "configured") {
            await this.api.sendMessage(chatId, "❌ Your YouTrack connection isn't configured yet. To configure a connection use /setup");
            return;
        }
        this.stateManager.setState(chatId, "idle");
        await this.db.removeUser(chatId);
        this.stateManager.removeUser(chatId);
        await this.api.sendMessage(chatId, "✅ Configuration reset successfully!");
    }

    private async handleList(chatId: number) {
        const user = this.stateManager.getUser(chatId);
        if(this.stateManager.getState(chatId) != "configured" || !user) {
            await this.api.sendMessage(chatId, "❌ Your YouTrack connection isn't configured yet. To configure a connection use /setup");
            return;
        }
      
        const projects = await this.yt.getProjects(user.youtrack_url, user.youtrack_token);
        let message = "📂 Your projects:\n\n";
        for (const p of projects) {
            message += `• ${p.id} — ${p.name}\n`;
        }

        await this.api.sendMessage(chatId, message);
    }

    private async handleCreate(chatId: number) {
        const user = this.stateManager.getUser(chatId);
        if(this.stateManager.getState(chatId) != "configured" || !user) {
            await this.api.sendMessage(chatId, "❌ Your YouTrack connection isn't configured yet. To configure a connection use /setup");
            return;
        }
        
        const projects = await this.yt.getProjects(user.youtrack_url, user.youtrack_token);

        if (projects.length === 0) {
            await this.api.sendMessage(chatId, "❌ No projects found or error fetching projects.");
            return;
        }

        const keyboard = [];
        
        for (let i = 0; i < projects.length; i += 2) {
            const row = [];
            
            row.push({
                text: `📁 ${projects[i].name}`,
                callback_data: `project_${projects[i].id}`
            });
            
            if (i + 1 < projects.length) {
                row.push({
                    text: `📁 ${projects[i + 1].name}`,
                    callback_data: `project_${projects[i + 1].id}`
                });
            }
            
            keyboard.push(row);
        }

        keyboard.push([
            {
                text: "❌ Cancel",
                callback_data: "cancel_create"
            }
        ]);

        await this.api.sendMessageWithKeyboard(chatId, "🗂️ Select a project for the new issue:", keyboard);

        this.stateManager.setState(chatId, "awaiting_project_selection");
    }

    private async handleSkip(chatId: number) {
        if (this.stateManager.getState(chatId) === "awaiting_desc") {
            const user = this.stateManager.getUser(chatId);
            const tempIssue = this.stateManager.getTempIssueData(chatId);
            
            if(!user || !tempIssue) {
                await this.api.sendMessage(chatId, "❌ There was an error while creating a new Issue, please try again.");
                this.stateManager.setState(chatId, "configured");
                return;
            }

            const issue = {
                project: {id: tempIssue.projectId! },
                summary: tempIssue.summary!,
                description: undefined
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
                `✅ Issue created without description!`,
            );
            
            this.stateManager.setState(chatId, "configured");
            this.stateManager.clearTempIssueData(chatId);
        } else {
            await this.api.sendMessage(chatId, "❌ This command can only be used when adding a description.");
        }
    }
}