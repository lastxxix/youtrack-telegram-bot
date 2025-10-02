import dotenv from "dotenv";

import axios, { AxiosError, AxiosInstance } from "axios";
import { YouTrackIssue, YouTrackProject } from "../models/youtrack";

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