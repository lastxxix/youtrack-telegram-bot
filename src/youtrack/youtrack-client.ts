import dotenv from "dotenv";

import axios, { AxiosError, AxiosInstance } from "axios";
import { YouTrackIssue, YouTrackNotification, YouTrackNotificationResponse, YouTrackProject } from "../models/youtrack";
import { gunzipSync } from "zlib";
import { time } from "console";

export class YouTrackClient {
    private axiosClient: AxiosInstance | null = null;
    private lastCheckTimestamp: number = Date.now();

    private initializeClient(baseUrl: string, token: string): AxiosInstance {
        if (!this.axiosClient) {
            this.axiosClient = axios.create({
                baseURL: baseUrl,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
        }
        return this.axiosClient;
    }

    public async validateToken(baseUrl: string, token: string): Promise<boolean> {
        try {
            const client = this.initializeClient(baseUrl, token);

            const response = await client.get(`/admin/projects?fields=id,name`);
            return response.status === 200;
        } catch (error) {
            console.error("Error validating YouTrack token:", error);
            return false;
        }
    }

    public async getProjects(baseUrl: string, token: string): Promise<YouTrackProject[]> {
        try {
            const client = this.initializeClient(baseUrl, token);
            const response = await client.get<YouTrackProject[]>(`/admin/projects?fields=id,name`);
            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                console.error("YouTrack API Error:", axiosError.response?.data || axiosError.message);
            } else {
                console.error("Unexpected Error:", error);
            }
        
        }
        return [];
    }

    private getFieldValue(fields: any[], fieldName: string): string | undefined {
        const fieldMap: { [key: string]: string[] } = {
            'State': ['Stato', 'State'],
            'Priority': ['Priorità', 'Priority'],
            'Assignee': ['Assegnatario', 'Assignee']
        };

        const possibleNames = fieldMap[fieldName] || [fieldName];
        
        for (const name of possibleNames) {
            const field = fields?.find((f: any) => f.name === name);
            if (field) return field.value;
        }
        
        return undefined;
    }

    private parseNotifications(notifications: any[], since?: number): YouTrackNotification[] {
        const parsed: YouTrackNotification[] = [];
        const sinceTime = since ? new Date(since).getTime() : 0;

        for (const notification of notifications) {
            try {
                const buffer = Buffer.from(notification.metadata, "base64");
                const decompressed = gunzipSync(buffer).toString("utf-8");
                const metadata = JSON.parse(decompressed);

                const issue = metadata.issue;
                const change = metadata.change;
                const events = change?.events || [];
                const timestamp = change?.startTimestamp ?? change?.endTimestamp;
                
                if (sinceTime && timestamp < sinceTime) continue;

                const state = this.getFieldValue(issue.fields, 'State');
                const priority = this.getFieldValue(issue.fields, 'Priority');
                const assignee = this.getFieldValue(issue.fields, 'Assignee');

                const commentEvent = events.find((e: any) => 
                    e.category === "COMMENT" && e.addedValues?.length > 0
                );
                const commentCreatedEvent = events.find((e: any) => 
                    e.category === "COMMENTS" && e.name === "comment created"
                );
                
                const comment = commentEvent?.addedValues?.[0]?.name;

                let eventType = metadata.header || "Unknown";
                let category = "";

                if (comment || commentCreatedEvent) {
                    eventType = "Comment Added";
                    category = "COMMENT";
                } else if (events.some((e: any) => e.name === "created" && e.category !== "COMMENTS")) {
                    eventType = "Issue Created";
                    category = "ISSUE";
                }

                parsed.push({
                    issueId: issue.id,
                    project: issue.project || "Unknown",
                    summary: issue.summary || "No summary",
                    description: issue.description,
                    eventType,
                    timestamp: timestamp,
                    category,
                    comment: comment || undefined,
                    state: state || undefined,
                    priority: priority || undefined,
                    assignee: assignee !== "Non assegnato" ? assignee : undefined,
                });
            } catch (error) {
                console.error("Error while parsing a notification:", error);
            }
        }
        return parsed;
    }

    public async getNotifications(baseUrl: string, token: string, since?: number): Promise<YouTrackNotification[] | undefined>{
        try {
            const client = this.initializeClient(baseUrl, token);
            const response = await client.get<YouTrackNotificationResponse[]>(`/notifications?fields=id,content,metadata`);
            if (response.status === 200) {
                return this.parseNotifications(response.data, since);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                console.error("YouTrack API Error:", axiosError.response?.data || axiosError.message);
            } else {
                console.error("Unexpected Error:", error);
            }
            return undefined;
        }
    }

    public async createIssue(baseUrl: string, token: string, issue: YouTrackIssue): Promise<boolean> {
        try {
            const client = this.initializeClient(baseUrl, token);
            const response = await client.post<YouTrackProject[]>(`/issues`, issue);
            if (response.status === 200) {
                return true;
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                console.error("YouTrack API Error:", axiosError.response?.data || axiosError.message);
            } else {
                console.error("Unexpected Error:", error);
            }
        }
        return false;
    }
}