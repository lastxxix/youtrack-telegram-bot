import { open, Database } from 'sqlite';
import sqlite3  from 'sqlite3';
import { DB_PATH } from './config';
import { User } from '../models/db';

export class DatabaseController {
    private db!: Database;
    
    public async initialize() {
        this.db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });


        await this.db.run(`CREATE TABLE IF NOT EXISTS users (
            chat_id INTEGER PRIMARY KEY,
            youtrack_url TEXT,
            youtrack_token TEXT
        )`);
        
    }

    public async getUser(chatId: number): Promise<User | undefined> {
        return await this.db.get<User>(`SELECT * FROM users WHERE chat_id = ?`, [chatId]);;
    }

    public async addUser(chatId: number, youtrackUrl: string, youtrackToken: string): Promise<User | undefined> {

        await this.db.run(
            `INSERT OR REPLACE INTO users (chat_id, youtrack_url, youtrack_token) VALUES (?, ?, ?)`,
            [chatId, youtrackUrl, youtrackToken]
        );

        const user = await this.db.get<User>(
            `SELECT chat_id, youtrack_url, youtrack_token FROM users WHERE chat_id = ?`,
            [chatId]
        );

        return user;
    }

    public async getUsers(): Promise<User[]> {
        return await this.db.all<User[]>(`SELECT * FROM users`);;
    }

    public async removeUser(chatId: number): Promise<boolean>{
        return (await this.db.run(`DELETE FROM users where chat_id = ?`, chatId)).changes != 0;
    }


}