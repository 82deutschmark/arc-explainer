import { users, type User, type InsertUser } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getVisitorCount(page: string): Promise<number>;
  incrementVisitorCount(page: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private visitorStats: Map<string, number>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.visitorStats = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getVisitorCount(page: string): Promise<number> {
    return this.visitorStats.get(page) || 0;
  }

  async incrementVisitorCount(page: string): Promise<number> {
    const current = this.visitorStats.get(page) || 0;
    const next = current + 1;
    this.visitorStats.set(page, next);
    return next;
  }
}

export const storage = new MemStorage();
