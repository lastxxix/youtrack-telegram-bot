import axios, { AxiosInstance } from "axios";
import { BOT_COMMANDS, TELEGRAM_SERVER, TELEGRAM_TOKEN } from "../config/config";
import { off } from "process";
import { DatabaseController } from "../config/db";
import { YouTrackClient } from "../youtrack/youtrack-client";
import { User } from "../models/db";
import { TempYouTrackIssue } from "../models/youtrack";

export class TelegramBot {
    private axiosClient: AxiosInstance;
    private baseUrl: string;
    private offset: number;
    private userStates: Record<number, "idle" | "awaiting_url" | "awaiting_token" | "configured" | "awaiting_project_selection" | "awaiting_title" | "awaiting_desc">;
    private users: Map<number, User>;
    private db: DatabaseController;
    private yt: YouTrackClient;
    private tempData: Record<number, string>;
    private tempIssueData: Record<number, TempYouTrackIssue>;

    constructor() {
        this.baseUrl = TELEGRAM_SERVER + "/bot" + TELEGRAM_TOKEN;
        this.axiosClient = axios.create({
            baseURL: this.baseUrl,
            headers: {
                "Content-Type": "application/json"
            },
        });
        this.offset = 0;
        this.userStates = {};
        this.db = new DatabaseController();
        this.yt = new YouTrackClient();
        this.tempData = {};
        this.tempIssueData = {};
        this.users = new Map<number, User>();
    }

    private async initialize() {
        await this.db.initialize();
        console.log("Database initialized!")
        console.log("Initializing Telegram client...");
        const dbUsers = await this.db.getUsers();
        for (const user of dbUsers) {
            this.users.set(user.chat_id, user);
            this.userStates[user.chat_id] = "configured";
        }
        console.log("Retrieved existing users!", this.users);
    }

    private async getUpdates() {
        try {
            const response = await this.axiosClient.get(`/getUpdates?timeout=30&offset=${this.offset}`);
            if (response.status === 200 && response.data.ok) {      
                return response.data.result || [];
            }
        } catch(error) {
            console.error("Error fetching updates from Telegram:", error);
            return [];
        }
    }

    private async sendMessage(chatId: number, text: string, parse_mode?: string) {
        try {
            const response = await this.axiosClient.post(`/sendMessage`, {
                chat_id: chatId,
                text: text,
                parse_mode: parse_mode
            });
            if (response.status === 200 && response.data.ok) {
                console.log("Message sent to chat", chatId);
            }
        } catch (error) {
            console.error("Error sending message to Telegram:", error);
        }
    }
    
    private async handleUpdate(update: any) {
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || "";
            if (text.startsWith("/")) {
                await this.handleCommand(chatId, text);
                return;
            }
            await this.handleMessage(chatId, text);
        }
        
        if (update.callback_query) {
            await this.handleCallbackQuery(update.callback_query);
        }
        return;
    }

    private async handleCallbackQuery(callbackQuery: any) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        if (data.startsWith('project_') && this.userStates[chatId] === 'awaiting_project_selection') {
            const projectId = data.replace('project_', '');
            
            if (!this.tempIssueData[chatId]) {
                this.tempIssueData[chatId] = {};
            }
            this.tempIssueData[chatId].projectId = projectId;

            const user = this.users.get(chatId);
            if (!user) return;

            const projects = await this.yt.getProjects(user.youtrack_url, user.youtrack_token);
            const selectedProject = projects.find(p => p.id === projectId);

            await this.axiosClient.post(`/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id,
                text: `✅ Selected: ${selectedProject?.name || projectId}`
            });

            await this.axiosClient.post(`/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: `✅ Project selected: **${selectedProject?.name || projectId}**`,
                parse_mode: 'Markdown'
            });

            this.userStates[chatId] = "awaiting_title";
            await this.sendMessage(chatId, "📝 Please insert the Issue title:");
        }
        else if (data === 'cancel_create') {
            await this.axiosClient.post(`/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id
            });

            await this.axiosClient.post(`/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: "❌ Operation cancelled."
            });

            this.userStates[chatId] = "configured";
            delete this.tempIssueData[chatId];
        }
    }

    private async handleCommand(chatId: number, command: string) {
        switch (command.split(" ")[0]) {
            case "/start":
                await this.sendMessage(chatId, 
                    `👋 Welcome to the YouTrack Telegram Bot!\n\n` +
                    `I'm here to help you interact with YouTrack from Telegram.\n` +
                    `To get started, type /setup to configure your YouTrack URL and API token.\n\n` +
                    `If you need help at any time, use /help to see the available commands.`
                );
                break;
            case "/setup":
                if(this.userStates[chatId] == "configured"){
                    await this.sendMessage(chatId, "❌ Your YouTrack connection is already configured. To remove all the configurations use /reset");
                    return;
                }
                this.userStates[chatId] = "awaiting_url";
                await this.sendMessage(
                    chatId,
                    "Please insert YouTrack instance URL (e.g. https://instance.youtrack.cloud):",
                    "Markdown"
                );
                break;
            case "/reset":{
                if(this.userStates[chatId] != "configured") {
                    await this.sendMessage(chatId, "❌ Your YouTrack connection isn't configured yet. To configure a connection use /setup");
                    return;
                }
                this.userStates[chatId] = "idle"
                await this.db.removeUser(chatId);
                this.users.delete(chatId);
                await this.sendMessage(chatId, "✅ Configuration reset successfully!");
                break;
            }
            case "/list": {
                const user = this.users.get(chatId);
                if(this.userStates[chatId] != "configured" || !user) {
                    await this.sendMessage(chatId, "❌ Your YouTrack connection isn't configured yet. To configure a connection use /setup");
                    return;
                }
              
                const projects = await this.yt.getProjects(user.youtrack_url, user.youtrack_token) 
                let message = "📂 Your projects:\n\n";
                for (const p of projects) {
                    message += `• ${p.id} — ${p.name}\n`;
                }

                await this.sendMessage(chatId, message);
                break;
            }   
            case "/create": {
                const user = this.users.get(chatId);
                if(this.userStates[chatId] != "configured" || !user) {
                    await this.sendMessage(chatId, "❌ Your YouTrack connection isn't configured yet. To configure a connection use /setup");
                    return;
                }
                
                const projects = await this.yt.getProjects(user.youtrack_url, user.youtrack_token);

                if (projects.length === 0) {
                    await this.sendMessage(chatId, "❌ No projects found or error fetching projects.");
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

                await this.axiosClient.post(`/sendMessage`, {
                    chat_id: chatId,
                    text: "🗂️ Select a project for the new issue:",
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });

                this.userStates[chatId] = "awaiting_project_selection";
                
                break;
            }
            case "/skip": {
                if (this.userStates[chatId] === "awaiting_desc") {
                    const user = this.users.get(chatId);
                    if(!user || !this.tempIssueData[chatId]) {
                        await this.sendMessage(chatId, "❌ There was an error while creating a new Issue, please try again.");
                        this.userStates[chatId] = "configured";
                        return;
                    }

                    const issue = {
                        project: {id: this.tempIssueData[chatId].projectId! },
                        summary: this.tempIssueData[chatId].summary!,
                        description: undefined
                    };

                    const createdIssue = await this.yt.createIssue(user.youtrack_url, user.youtrack_token, issue);
                    
                    if(!createdIssue) {
                        await this.sendMessage(chatId, "❌ There was an error while creating a new Issue, please try again.");
                        this.userStates[chatId] = "configured";
                        delete this.tempIssueData[chatId];
                        return;
                    }
                
                    await this.sendMessage(
                        chatId, 
                        `✅ Issue created without description!`,
                    );
                    
                    this.userStates[chatId] = "configured";
                    delete this.tempIssueData[chatId];
                } else {
                    await this.sendMessage(chatId, "❌ This command can only be used when adding a description.");
                }
                break;
            }
            default:
                await this.sendMessage(chatId, "Unknown command, use /help to see available commands.");
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

    private async handleMessage(chatId: number, text: string) {
        const state = this.userStates[chatId] || "idle";

        if (state === "awaiting_url") {
            this.tempData[chatId] = this.fixUrl(text);
            this.userStates[chatId] = "awaiting_token";
            await this.sendMessage(chatId, "Perfect! Now insert your YouTrack Token:");
        } else if (state === "awaiting_token") {
            const token = text; 
            let url = this.tempData[chatId];
            if(!await this.yt.validateToken(url, token)) {
                await this.sendMessage(chatId, "❌ Invalid YouTrack URL or Token. Please try /setup again.");
                this.userStates[chatId] = "idle";
                return;
            }

            const user = await this.db.addUser(chatId, url, token);
            delete this.tempData[chatId];
            if(!user) {
                await this.sendMessage(chatId, "❌ There was an error saving your configuration. Please try /setup again.");
                this.userStates[chatId] = "idle";          
                return;
            }
            this.users.set(chatId, user);
            this.userStates[chatId] = "configured";
            await this.sendMessage(chatId, "✅ Configuration has been completed successfully!");
        } else if (state == "awaiting_title") {
            const title = text.trim();
            
            if (title.length === 0) {
                await this.sendMessage(chatId, "❌ Title cannot be empty. Please try again:");
                return;
            }
            
            if (!this.tempIssueData[chatId]) {
                this.tempIssueData[chatId] = {};
            }
            this.tempIssueData[chatId].summary = title;
            
            this.userStates[chatId] = "awaiting_desc";
            await this.sendMessage(chatId, "📄 Please insert the Issue description (or send /skip to create without description):");
        } else if (state == "awaiting_desc") {
            const user = this.users.get(chatId);
            if(!user || !this.tempIssueData[chatId]) {
                await this.sendMessage(chatId, "❌ There was an error while creating a new Issue, please try again.");
                this.userStates[chatId] = "configured";
                return;
            }
            
            const description = text.trim();
            this.tempIssueData[chatId].description = description.length > 0 ? description : undefined;

            const issue = {
                project: {id: this.tempIssueData[chatId].projectId!},
                summary: this.tempIssueData[chatId].summary!,
                description: this.tempIssueData[chatId].description
            };

            const createdIssue = await this.yt.createIssue(user.youtrack_url, user.youtrack_token, issue);
            
            if(!createdIssue) {
                await this.sendMessage(chatId, "❌ There was an error while creating a new Issue, please try again.");
                this.userStates[chatId] = "configured";
                delete this.tempIssueData[chatId];
                return;
            }

            await this.sendMessage(
                chatId, 
                `✅ Issue created successfully! `,
            );
            
            this.userStates[chatId] = "configured";
            delete this.tempIssueData[chatId];
        }
    }

    private async setCommands(): Promise<boolean> {
        try {
            const response = await this.axiosClient.post(`/setMyCommands`, {
                commands: BOT_COMMANDS
            });
            if (response.status === 200 && response.data.ok) {
                console.log("Bot commands set successfully.");
                return response.data.result === true;
            }
        } catch (error) {
            console.error("Error setting bot commands:", error);  
        }
        return false;
    }


    public async start(){
        console.log("Telegram bot started...");
        await this.initialize();
        await this.setCommands();  
        while(true) {
            try {
                const updates = await this.getUpdates();
                for (const update of updates) {
                    console.log("Received update:", update);
                    this.offset = update.update_id + 1;
                    await this.handleUpdate(update);
                }
            } catch (error) {
                console.error("Error in Telegram polling loop:", error);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
    }
}