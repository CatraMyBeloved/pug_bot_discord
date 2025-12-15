import { Role, Rank } from '../types/matchmaking';

export type RegistrationStep =
    | 'battlenet'
    | 'roles'
    | 'rank'
    | 'review';

export interface RegistrationData {
    battlenetId: string | null;
    selectedRoles: Role[];
    selectedRank: Rank | null;
}

export interface RegistrationSession {
    userId: string;
    messageId: string | null;
    channelId: string;
    startedAt: number;
    currentStep: RegistrationStep;
    data: RegistrationData;
}

export class RegistrationStateManager {
    private sessions: Map<string, RegistrationSession>;
    private cleanupInterval: NodeJS.Timeout | null;

    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = null;
    }

    private getKey(userId: string): string {
        return userId;
    }

    createSession(userId: string, channelId: string): RegistrationSession {
        const key = this.getKey(userId);

        // Check if session already exists
        if (this.sessions.has(key)) {
            throw new Error('Session already exists for this user');
        }

        const session: RegistrationSession = {
            userId,
            messageId: null,
            channelId,
            startedAt: Date.now(),
            currentStep: 'battlenet',
            data: {
                battlenetId: null,
                selectedRoles: [],
                selectedRank: null,
            },
        };

        this.sessions.set(key, session);
        return session;
    }

    getSession(userId: string): RegistrationSession | null {
        const key = this.getKey(userId);
        return this.sessions.get(key) || null;
    }

    updateSession(userId: string, updates: Partial<RegistrationSession>): void {
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

    updateData(userId: string, dataUpdate: Partial<RegistrationData>): void {
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

    isStepComplete(step: RegistrationStep, data: RegistrationData): boolean {
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

    canProceedToReview(data: RegistrationData): boolean {
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
                console.log(`Cleaned up expired registration session: ${key}`);
            }
        }
    }

    getAllSessions(): RegistrationSession[] {
        return Array.from(this.sessions.values());
    }

    getSessionCount(): number {
        return this.sessions.size;
    }
}

// Singleton instance
export const registrationState = new RegistrationStateManager();
