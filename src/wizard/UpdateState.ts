import { Role, Rank } from '../types/matchmaking';

export type UpdateStep =
    | 'battlenet'
    | 'roles'
    | 'rank'
    | 'review';

export interface UpdateData {
    battlenetId: string | null;
    selectedRoles: Role[];
    selectedRank: Rank | null;
}

export interface UpdateSession {
    userId: string;
    messageId: string | null;
    channelId: string;
    startedAt: number;
    currentStep: UpdateStep;
    data: UpdateData;
}

export class UpdateStateManager {
    private sessions: Map<string, UpdateSession>;
    private cleanupInterval: NodeJS.Timeout | null;

    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = null;
    }

    private getKey(userId: string): string {
        return userId;
    }

    createSession(userId: string, channelId: string, initialData: UpdateData): UpdateSession {
        const key = this.getKey(userId);

        // Check if session already exists
        if (this.sessions.has(key)) {
            // Overwrite existing session or throw error?
            // Let's overwrite for updates to be user-friendly if they restart
            // But registration wizard throws error. Let's follow pattern and check in command.
            // Actually, if I throw here, I must check in command.
            throw new Error('Session already exists for this user');
        }

        const session: UpdateSession = {
            userId,
            messageId: null,
            channelId,
            startedAt: Date.now(),
            currentStep: 'battlenet',
            data: initialData,
        };

        this.sessions.set(key, session);
        return session;
    }

    getSession(userId: string): UpdateSession | null {
        const key = this.getKey(userId);
        return this.sessions.get(key) || null;
    }

    updateSession(userId: string, updates: Partial<UpdateSession>): void {
        const key = this.getKey(userId);
        const session = this.sessions.get(key);

        if (!session) {
            throw new Error('Session not found');
        }

        // Merge updates
        Object.assign(session, updates);

        // Special handling for data updates
        if (updates.data) {
            Object.assign(session.data, updates.data);
        }
    }

    updateData(userId: string, dataUpdate: Partial<UpdateData>): void {
        const session = this.getSession(userId);
        if (!session) {
            throw new Error('Session not found');
        }

        Object.assign(session.data, dataUpdate);
    }

    deleteSession(userId: string): void {
        const key = this.getKey(userId);
        this.sessions.delete(key);
    }

    isStepComplete(step: UpdateStep, data: UpdateData): boolean {
        switch (step) {
            case 'battlenet':
                return data.battlenetId !== null && data.battlenetId.length > 0;
            case 'roles':
                return data.selectedRoles.length > 0;
            case 'rank':
                return data.selectedRank !== null;
            case 'review':
                return this.canProceedToReview(data);
            default:
                return false;
        }
    }

    canProceedToReview(data: UpdateData): boolean {
        return (
            data.battlenetId !== null &&
            data.battlenetId.length > 0 &&
            data.selectedRoles.length > 0 &&
            data.selectedRank !== null
        );
    }

    startCleanupTimer(): void {
        if (this.cleanupInterval) {
            return; // Already running
        }

        // Run cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    stopCleanupTimer(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    private cleanup(): void {
        const now = Date.now();
        const expiryTime = 15 * 60 * 1000; // 15 minutes

        for (const [key, session] of this.sessions.entries()) {
            if (now - session.startedAt > expiryTime) {
                this.sessions.delete(key);
                console.log(`Cleaned up expired update session: ${key}`);
            }
        }
    }

    getAllSessions(): UpdateSession[] {
        return Array.from(this.sessions.values());
    }

    getSessionCount(): number {
        return this.sessions.size;
    }
}

// Singleton instance
export const updateState = new UpdateStateManager();
