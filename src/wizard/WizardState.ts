export type WizardCategory =
    | 'voice_channels'
    | 'roles'
    | 'announcements'
    | 'settings';

export interface WizardSettings {
    mainVcId: string | null;
    team1VcId: string | null;
    team2VcId: string | null;
    pugRoleId: string | null;
    pugLeaderRoleIds: string[];
    announcementChannelId: string | null;
    autoMove: boolean;
    fairnessWeight: number;
    priorityWeight: number;
}

export interface WizardSession {
    userId: string;
    guildId: string;
    messageId: string | null;
    channelId: string;
    startedAt: number;
    currentCategory: WizardCategory | null;
    settings: WizardSettings;
    completedCategories: Set<WizardCategory>;
}

export class WizardStateManager {
    private sessions: Map<string, WizardSession>;
    private cleanupInterval: NodeJS.Timeout | null;

    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = null;
    }

    private getKey(userId: string, guildId: string): string {
        return `${guildId}:${userId}`;
    }

    createSession(userId: string, guildId: string, channelId: string): WizardSession {
        const key = this.getKey(userId, guildId);

        // Check if session already exists
        if (this.sessions.has(key)) {
            throw new Error('Session already exists for this user in this guild');
        }

        const session: WizardSession = {
            userId,
            guildId,
            messageId: null,
            channelId,
            startedAt: Date.now(),
            currentCategory: null,
            settings: {
                mainVcId: null,
                team1VcId: null,
                team2VcId: null,
                pugRoleId: null,
                pugLeaderRoleIds: [],
                announcementChannelId: null,
                autoMove: true, // Default value
                fairnessWeight: 0.2,
                priorityWeight: 0.8,
            },
            completedCategories: new Set(),
        };

        this.sessions.set(key, session);
        return session;
    }

    getSession(userId: string, guildId: string): WizardSession | null {
        const key = this.getKey(userId, guildId);
        return this.sessions.get(key) || null;
    }

    updateSession(userId: string, guildId: string, updates: Partial<WizardSession>): void {
        const key = this.getKey(userId, guildId);
        const session = this.sessions.get(key);

        if (!session) {
            throw new Error('Session not found');
        }

        // Merge updates
        Object.assign(session, updates);

        // Special handling for settings updates
        if (updates.settings) {
            Object.assign(session.settings, updates.settings);
        }
    }

    deleteSession(userId: string, guildId: string): void {
        const key = this.getKey(userId, guildId);
        this.sessions.delete(key);
    }

    updateSettings(
        userId: string,
        guildId: string,
        settingsUpdate: Partial<WizardSettings>
    ): void {
        const session = this.getSession(userId, guildId);
        if (!session) {
            throw new Error('Session not found');
        }

        Object.assign(session.settings, settingsUpdate);

        // Update completed categories based on current settings
        this.updateCompletedCategories(session);
    }

    private updateCompletedCategories(session: WizardSession): void {
        const { settings } = session;

        // Voice Channels category
        if (settings.mainVcId && settings.team1VcId && settings.team2VcId) {
            session.completedCategories.add('voice_channels');
        } else {
            session.completedCategories.delete('voice_channels');
        }

        // Roles category
        if (settings.pugRoleId && settings.pugLeaderRoleIds.length > 0) {
            session.completedCategories.add('roles');
        } else {
            session.completedCategories.delete('roles');
        }

        // Announcements category
        if (settings.announcementChannelId) {
            session.completedCategories.add('announcements');
        } else {
            session.completedCategories.delete('announcements');
        }

        // Settings category (always complete since auto_move has default)
        session.completedCategories.add('settings');
    }

    isComplete(userId: string, guildId: string): boolean {
        const session = this.getSession(userId, guildId);
        if (!session) {
            return false;
        }

        // All required categories must be complete
        const requiredCategories: WizardCategory[] = [
            'voice_channels',
            'roles',
            'announcements',
            'settings'
        ];

        return requiredCategories.every(cat =>
            session.completedCategories.has(cat)
        );
    }

    getIncompleteCategories(userId: string, guildId: string): WizardCategory[] {
        const session = this.getSession(userId, guildId);
        if (!session) {
            return [];
        }

        const requiredCategories: WizardCategory[] = [
            'voice_channels',
            'roles',
            'announcements',
            'settings'
        ];

        return requiredCategories.filter(cat =>
            !session.completedCategories.has(cat)
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
                console.log(`Cleaned up expired wizard session: ${key}`);
            }
        }
    }

    getAllSessions(): WizardSession[] {
        return Array.from(this.sessions.values());
    }

    getSessionCount(): number {
        return this.sessions.size;
    }
}

// Singleton instance
export const wizardState = new WizardStateManager();
