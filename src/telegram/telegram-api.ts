import axios, { AxiosInstance } from "axios";
import { TELEGRAM_SERVER, TELEGRAM_TOKEN } from "../config/config";

export class TelegramAPI {
    private axiosClient: AxiosInstance;
    private baseUrl: string;

    constructor() {
        this.baseUrl = TELEGRAM_SERVER + "/bot" + TELEGRAM_TOKEN;
        this.axiosClient = axios.create({
            baseURL: this.baseUrl,
            headers: {
                "Content-Type": "application/json"
            },
        });
    }

    async getUpdates(offset: number) {
        try {
            const response = await this.axiosClient.get(`/getUpdates?timeout=30&offset=${offset}`);
            if (response.status === 200 && response.data.ok) {      
                return response.data.result || [];
            }
        } catch(error) {
            console.error("Error fetching updates from Telegram:", error);
            return [];
        }
    }

    async sendMessage(chatId: number, text: string, parse_mode?: string) {
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

    async sendMessageWithKeyboard(chatId: number, text: string, keyboard: any) {
        try {
            const response = await this.axiosClient.post(`/sendMessage`, {
                chat_id: chatId,
                text: text,
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });
            if (response.status === 200 && response.data.ok) {
                console.log("Message with keyboard sent to chat", chatId);
            }
        } catch (error) {
            console.error("Error sending message with keyboard to Telegram:", error);
        }
    }

    async editMessageText(chatId: number, messageId: number, text: string, parse_mode?: string) {
        try {
            await this.axiosClient.post(`/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: parse_mode
            });
        } catch (error) {
            console.error("Error editing message:", error);
        }
    }

    async answerCallbackQuery(callbackQueryId: string, text?: string) {
        try {
            await this.axiosClient.post(`/answerCallbackQuery`, {
                callback_query_id: callbackQueryId,
                text: text
            });
        } catch (error) {
            console.error("Error answering callback query:", error);
        }
    }

    async setCommands(commands: any[]): Promise<boolean> {
        try {
            const response = await this.axiosClient.post(`/setMyCommands`, {
                commands: commands
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
}