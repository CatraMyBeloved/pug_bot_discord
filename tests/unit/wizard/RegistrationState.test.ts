import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
    RegistrationStateManager,
    RegistrationSession,
    RegistrationData,
} from '../../../src/wizard/RegistrationState';

describe('RegistrationStateManager', () => {
    let stateManager: RegistrationStateManager;

    beforeEach(() => {
        stateManager = new RegistrationStateManager();
    });

    afterEach(() => {
        stateManager.stopCleanupTimer();
    });

    describe('createSession', () => {
        it('creates a new session with default values', () => {
            const session = stateManager.createSession('user1', 'channel1');

            expect(session.userId).toBe('user1');
            expect(session.channelId).toBe('channel1');
            expect(session.messageId).toBeNull();
            expect(session.currentStep).toBe('battlenet');
            expect(session.data.battlenetId).toBeNull();
            expect(session.data.selectedRoles).toEqual([]);
            expect(session.data.selectedRank).toBeNull();
            expect(session.startedAt).toBeGreaterThan(0);
        });

        it('throws error if session already exists for user', () => {
            stateManager.createSession('user1', 'channel1');

            expect(() => {
                stateManager.createSession('user1', 'channel2');
            }).toThrow('Session already exists for this user');
        });

        it('allows different users to have sessions', () => {
            const session1 = stateManager.createSession('user1', 'channel1');
            const session2 = stateManager.createSession('user2', 'channel2');

            expect(session1.userId).toBe('user1');
            expect(session2.userId).toBe('user2');
            expect(stateManager.getSessionCount()).toBe(2);
        });
    });

    describe('getSession', () => {
        it('returns session if it exists', () => {
            stateManager.createSession('user1', 'channel1');

            const session = stateManager.getSession('user1');

            expect(session).not.toBeNull();
            expect(session?.userId).toBe('user1');
        });

        it('returns null if session does not exist', () => {
            const session = stateManager.getSession('nonexistent');

            expect(session).toBeNull();
        });
    });

    describe('updateSession', () => {
        it('updates session fields', () => {
            stateManager.createSession('user1', 'channel1');

            stateManager.updateSession('user1', {
                messageId: 'msg123',
                currentStep: 'roles',
            });

            const session = stateManager.getSession('user1');
            expect(session?.messageId).toBe('msg123');
            expect(session?.currentStep).toBe('roles');
        });

        it('throws error if session not found', () => {
            expect(() => {
                stateManager.updateSession('nonexistent', {messageId: 'msg123'});
            }).toThrow('Session not found');
        });

        it('updates nested data fields', () => {
            stateManager.createSession('user1', 'channel1');

            stateManager.updateData('user1', {
                battlenetId: 'Player#1234',
            });

            const session = stateManager.getSession('user1');
            expect(session?.data.battlenetId).toBe('Player#1234');
        });
    });

    describe('updateData', () => {
        it('updates data fields', () => {
            stateManager.createSession('user1', 'channel1');

            stateManager.updateData('user1', {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank', 'dps'],
            });

            const session = stateManager.getSession('user1');
            expect(session?.data.battlenetId).toBe('Player#1234');
            expect(session?.data.selectedRoles).toEqual(['tank', 'dps']);
        });

        it('throws error if session not found', () => {
            expect(() => {
                stateManager.updateData('nonexistent', {battlenetId: 'Player#1234'});
            }).toThrow('Session not found');
        });

        it('partially updates data', () => {
            stateManager.createSession('user1', 'channel1');

            stateManager.updateData('user1', {battlenetId: 'Player#1234'});
            stateManager.updateData('user1', {selectedRoles: ['support']});

            const session = stateManager.getSession('user1');
            expect(session?.data.battlenetId).toBe('Player#1234');
            expect(session?.data.selectedRoles).toEqual(['support']);
        });
    });

    describe('deleteSession', () => {
        it('deletes session', () => {
            stateManager.createSession('user1', 'channel1');
            expect(stateManager.getSession('user1')).not.toBeNull();

            stateManager.deleteSession('user1');

            expect(stateManager.getSession('user1')).toBeNull();
        });

        it('does not throw error if session does not exist', () => {
            expect(() => {
                stateManager.deleteSession('nonexistent');
            }).not.toThrow();
        });
    });

    describe('isStepComplete', () => {
        it('returns true for battlenet step when battlenetId is set', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: [],
                selectedRank: null,
            };

            expect(stateManager.isStepComplete('battlenet', data)).toBe(true);
        });

        it('returns false for battlenet step when battlenetId is null', () => {
            const data: RegistrationData = {
                battlenetId: null,
                selectedRoles: [],
                selectedRank: null,
            };

            expect(stateManager.isStepComplete('battlenet', data)).toBe(false);
        });

        it('returns true for roles step when at least one role is selected', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank'],
                selectedRank: null,
            };

            expect(stateManager.isStepComplete('roles', data)).toBe(true);
        });

        it('returns false for roles step when no roles are selected', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: [],
                selectedRank: null,
            };

            expect(stateManager.isStepComplete('roles', data)).toBe(false);
        });

        it('returns true for rank step when rank is selected', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank'],
                selectedRank: 'gold',
            };

            expect(stateManager.isStepComplete('rank', data)).toBe(true);
        });

        it('returns false for rank step when rank is null', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank'],
                selectedRank: null,
            };

            expect(stateManager.isStepComplete('rank', data)).toBe(false);
        });

        it('returns true for review step when all data is complete', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank', 'support'],
                selectedRank: 'diamond',
            };

            expect(stateManager.isStepComplete('review', data)).toBe(true);
        });

        it('returns false for review step when data is incomplete', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: [],
                selectedRank: null,
            };

            expect(stateManager.isStepComplete('review', data)).toBe(false);
        });
    });

    describe('canProceedToReview', () => {
        it('returns true when all data is complete', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank', 'dps', 'support'],
                selectedRank: 'master',
            };

            expect(stateManager.canProceedToReview(data)).toBe(true);
        });

        it('returns false when battlenetId is null', () => {
            const data: RegistrationData = {
                battlenetId: null,
                selectedRoles: ['tank'],
                selectedRank: 'gold',
            };

            expect(stateManager.canProceedToReview(data)).toBe(false);
        });

        it('returns false when selectedRoles is empty', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: [],
                selectedRank: 'gold',
            };

            expect(stateManager.canProceedToReview(data)).toBe(false);
        });

        it('returns false when selectedRank is null', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['dps'],
                selectedRank: null,
            };

            expect(stateManager.canProceedToReview(data)).toBe(false);
        });
    });

    describe('cleanup', () => {
        it('removes sessions older than 15 minutes', () => {
            // Create session with old timestamp
            const session = stateManager.createSession('user1', 'channel1');
            // Manually set startedAt to 16 minutes ago
            session.startedAt = Date.now() - (16 * 60 * 1000);

            // Manually trigger cleanup (private method, so we access via timer)
            (stateManager as any).cleanup();

            expect(stateManager.getSession('user1')).toBeNull();
        });

        it('keeps sessions newer than 15 minutes', () => {
            // Create session with recent timestamp
            stateManager.createSession('user1', 'channel1');

            // Manually trigger cleanup
            (stateManager as any).cleanup();

            expect(stateManager.getSession('user1')).not.toBeNull();
        });

        it('cleans up multiple old sessions', () => {
            const session1 = stateManager.createSession('user1', 'channel1');
            const session2 = stateManager.createSession('user2', 'channel2');
            const session3 = stateManager.createSession('user3', 'channel3');

            // Set user1 and user2 to old timestamps
            session1.startedAt = Date.now() - (16 * 60 * 1000);
            session2.startedAt = Date.now() - (20 * 60 * 1000);
            // user3 stays recent

            (stateManager as any).cleanup();

            expect(stateManager.getSession('user1')).toBeNull();
            expect(stateManager.getSession('user2')).toBeNull();
            expect(stateManager.getSession('user3')).not.toBeNull();
        });
    });

    describe('cleanupTimer', () => {
        it('starts cleanup timer', () => {
            stateManager.startCleanupTimer();

            expect((stateManager as any).cleanupInterval).not.toBeNull();

            stateManager.stopCleanupTimer();
        });

        it('does not create duplicate timer if already running', () => {
            stateManager.startCleanupTimer();
            const firstInterval = (stateManager as any).cleanupInterval;

            stateManager.startCleanupTimer();
            const secondInterval = (stateManager as any).cleanupInterval;

            expect(firstInterval).toBe(secondInterval);

            stateManager.stopCleanupTimer();
        });

        it('stops cleanup timer', () => {
            stateManager.startCleanupTimer();
            expect((stateManager as any).cleanupInterval).not.toBeNull();

            stateManager.stopCleanupTimer();

            expect((stateManager as any).cleanupInterval).toBeNull();
        });
    });

    describe('getAllSessions', () => {
        it('returns all active sessions', () => {
            stateManager.createSession('user1', 'channel1');
            stateManager.createSession('user2', 'channel2');

            const sessions = stateManager.getAllSessions();

            expect(sessions).toHaveLength(2);
            expect(sessions.map(s => s.userId)).toContain('user1');
            expect(sessions.map(s => s.userId)).toContain('user2');
        });

        it('returns empty array when no sessions', () => {
            const sessions = stateManager.getAllSessions();

            expect(sessions).toEqual([]);
        });
    });

    describe('getSessionCount', () => {
        it('returns correct count of sessions', () => {
            expect(stateManager.getSessionCount()).toBe(0);

            stateManager.createSession('user1', 'channel1');
            expect(stateManager.getSessionCount()).toBe(1);

            stateManager.createSession('user2', 'channel2');
            expect(stateManager.getSessionCount()).toBe(2);

            stateManager.deleteSession('user1');
            expect(stateManager.getSessionCount()).toBe(1);
        });
    });
});
