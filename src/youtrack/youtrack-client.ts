import dotenv from "dotenv";

import axios, { AxiosError, AxiosInstance } from "axios";
import { YouTrackProject } from "../models/youtrack";

export class YouTrackClient {

    public async validateToken(baseUrl: string, token: string): Promise<boolean> {
        try {
            const axiosClient = axios.create({
                baseURL: baseUrl,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            const response = await axiosClient.get(`/admin/projects?fields=id,name`);
            return response.status === 200;
        } catch (error) {
            console.error("Error validating YouTrack token:", error);
            return false;
        }
    }

    public async getNotifications(baseUrl: string, token: string){
        const axiosClient = axios.create({
            baseURL: baseUrl,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        const response = await axiosClient.get(`/admin/projects?fields=id,name`);
    }
    
    public async getProjects(baseUrl: string, token: string): Promise<YouTrackProject[]> {
        try {
            const axiosClient = axios.create({
                baseURL: baseUrl,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            const response = await axiosClient.get<YouTrackProject[]>(`/admin/projects?fields=id,name`);
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
}