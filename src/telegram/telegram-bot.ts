import axios, { AxiosInstance } from "axios";
import { BOT_COMMANDS, TELEGRAM_SERVER, TELEGRAM_TOKEN } from "../config/config";
import { off } from "process";
import { DatabaseController } from "../config/db";
import { YouTrackClient } from "../youtrack/youtrack-client";
import { User } from "../models/db";
export class TelegramBot {
    private axiosClient: AxiosInstance;
    private baseUrl: string;
    private offset: number;
    private userStates: Record<number, "idle" | "awaiting_url" | "awaiting_token" | "configured">;
    private users: Map<number, User>;
    private db: DatabaseController;
    private yt: YouTrackClient;
    private tempUrls: Record<number, string>;

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
        this.tempUrls = {};
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
        return;
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
                break;
            }
            case "/list": {
                const user = this.users.get(chatId);
                if(this.userStates[chatId] != "configured" || !user) {
                    await this.sendMessage(chatId, "❌ Your YouTrack connection isn't configured yet. To configure a connection use /setup");
                    return;
                }
              
                const projects = await this.yt.getProjects(user.youtrack_url, user.youtrack_token) 
                let message = "📂 Your project\n\n";
                for (const p of projects) {
                    message += `• ${p.id} — ${p.name}\n`;
                }

                await this.sendMessage(chatId, message);
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
        return url +"/api";
    }

    private async handleMessage(chatId: number, text: string) {
        const state = this.userStates[chatId] || "idle";

        if (state === "awaiting_url") {
            this.tempUrls[chatId] = this.fixUrl(text);
            this.userStates[chatId] = "awaiting_token";
            await this.sendMessage(chatId, "Perfect! Now insert your YouTrack Token:");
        } else if (state === "awaiting_token") {
            const token = text; 
            let url = this.tempUrls[chatId];
            if(!await this.yt.validateToken(url, token)) {
                await this.sendMessage(chatId, "❌ Invalid YouTrack URL or Token. Please try /setup again.");
                this.userStates[chatId] = "idle";
                return;
            }

            const user = await this.db.addUser(chatId, url, token);
            delete this.tempUrls[chatId];
            if(!user) {
                await this.sendMessage(chatId, "❌ There was an error saving your configuration. Please try /setup again.");
                this.userStates[chatId] = "idle";          
                return;
            }
            this.users.set(chatId, user);
            this.userStates[chatId] = "configured";
            await this.sendMessage(chatId, "✅ Configuration has been completed successfully!");
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
                    this.handleUpdate(update);
                }
            } catch (error) {
                console.error("Error in Telegram polling loop:", error);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
    }
}