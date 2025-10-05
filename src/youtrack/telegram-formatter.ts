import { YouTrackNotification } from "../models/youtrack";

export class TelegramFormatter {
    public formatNotification(notification: YouTrackNotification): string {
        const emoji = this.getEmojiForCategory(notification.category);
        
        let message = `${emoji} *${notification.eventType}*\n\n`;
        message += `📋 Project: ${notification.project.name}\n`;
        message += `🎫 Issue: \`${notification.summary}\`\n`;

        if(notification.category == "ISSUE" && notification.description){
            message += `📝 Description: ${notification.description}\n\n`;
        }  
        
        if (notification.comment) {
            message += `💬 Comment:\n_${this.escapeMarkdown(notification.comment).trim()}_\n`;
        }
        
        if (notification.state) {
            message += `📊 State: ${notification.state}\n`;
        }
        
        if (notification.priority) {
            message += `⚠️ Priority: ${notification.priority}\n`;
        }
        
        if (notification.assignee) {
            message += `👤 Assignee: ${notification.assignee}\n`;
        }
        
        message += `\n🕐 ${new Date(notification.timestamp).toISOString() + " UTC"}`;
        
        return message;
    }

    private getEmojiForCategory(category: string): string {
        const emojiMap: { [key: string]: string } = {
            'COMMENT': '💬',
            'ISSUE': '🆕',
        };
        return emojiMap[category] || '📌';
    }

    private escapeMarkdown(text: string): string {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    public formatNotifications(notifications: YouTrackNotification[]): string[] {
        return notifications.map(n => this.formatNotification(n));
    }
}