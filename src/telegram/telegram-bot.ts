import { BOT_COMMANDS } from "../config/config";
import { DatabaseController } from "../config/db";
import { YouTrackClient } from "../youtrack/youtrack-client";
import { TelegramAPI } from "./telegram-api";
import { StateManager } from "./state-manager";
import { CommandHandler } from "./command-handler";
import { MessageHandler } from "./message-handler";
import { CallbackHandler } from "./callback-handler";
import { NotificationService } from "../services/notification-service";

export class TelegramBot {
    private api: TelegramAPI;
    private offset: number;
    private stateManager: StateManager;
    private db: DatabaseController;
    private yt: YouTrackClient;
    private commandHandler: CommandHandler;
    private messageHandler: MessageHandler;
    private callbackHandler: CallbackHandler;
    private notificationService: NotificationService;

    constructor() {
        this.api = new TelegramAPI();
        this.offset = 0;
        this.stateManager = new StateManager();
        this.db = new DatabaseController();
        this.yt = new YouTrackClient();
        this.notificationService = new NotificationService(this.api, this.stateManager, this.yt);
        this.commandHandler = new CommandHandler(this.api, this.stateManager, this.db, this.yt);
        this.messageHandler = new MessageHandler(this.api, this.stateManager, this.db, this.yt, this.notificationService);
        this.callbackHandler = new CallbackHandler(this.api, this.stateManager, this.yt);
        
    }

    private async initialize() {
        await this.db.initialize();
        console.log("Database initialized!")
        console.log("Initializing Telegram client...");
        const dbUsers = await this.db.getUsers();
        for (const user of dbUsers) {
            if(!await this.yt.validateToken(user.youtrack_url, user.youtrack_token)){
                await this.db.removeUser(user.chat_id);
                console.log("User", user.chat_id, "has not a valid token, removing from db...");
                continue;
            } 
            this.stateManager.setUser(user.chat_id, user);
            this.notificationService.startPollingForUser(user.chat_id);
        }
        console.log("Retrieved", this.stateManager.getAllUsers().size, "existing users!");
    }

    private async handleUpdate(update: any) {
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || "";
            if (text.startsWith("/")) {
                await this.commandHandler.handleCommand(chatId, text);
                return;
            }
            await this.messageHandler.handleMessage(chatId, text);
        }
        
        if (update.callback_query) {
            await this.callbackHandler.handleCallbackQuery(update.callback_query);
        }
        return;
    }

    public async start(){
        console.log("Telegram bot started...");
        await this.initialize();
        await this.api.setCommands(BOT_COMMANDS);  
        while(true) {
            try {
                const updates = await this.api.getUpdates(this.offset);
                for (const update of updates) {
                    //console.log("Received update:", update);
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