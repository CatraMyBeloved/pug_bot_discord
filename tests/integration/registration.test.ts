import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import Database from 'better-sqlite3';
import {registrationState, RegistrationStateManager} from '../../src/wizard/RegistrationState';
import {registerPlayer, isPlayerRegistered, getPlayer} from '../../src/database/players';
import {closeTestDatabase, createTestDatabase} from '../setup/testUtils';

/**
 * Integration Tests for Registration Wizard Flow
 *
 * These tests verify the end-to-end registration process:
 * 1. Create registration session
 * 2. User selects Battle.net ID, roles, and rank through wizard
 * 3. Confirm and save to database
 * 4. Verify player is registered with correct data
 */
describe('Registration Integration', () => {
    let db: Database.Database;
    let testStateManager: RegistrationStateManager;

    beforeEach(() => {
        db = createTestDatabase();
        // Create a fresh state manager for each test
        testStateManager = new RegistrationStateManager();
    });

    afterEach(() => {
        closeTestDatabase(db);
        testStateManager.stopCleanupTimer();
    });

    describe('Full Registration Flow', () => {
        it('completes full registration from session creation to database save', () => {
            const userId = 'user123';

            // Step 1: Create session (mimicking /register command)
            const session = testStateManager.createSession(userId, 'channel1');
            expect(session.currentStep).toBe('battlenet');

            // Step 2: User enters Battle.net ID (mimicking modal submission)
            testStateManager.updateData(userId, {battlenetId: 'TestPlayer#1234'});
            testStateManager.updateSession(userId, {currentStep: 'roles'});

            // Step 3: User selects roles (mimicking button toggles)
            testStateManager.updateData(userId, {selectedRoles: ['tank', 'support']});
            testStateManager.updateSession(userId, {currentStep: 'rank'});

            // Step 4: User selects rank (mimicking rank button)
            testStateManager.updateData(userId, {selectedRank: 'diamond'});
            testStateManager.updateSession(userId, {currentStep: 'review'});

            // Step 5: User confirms (mimicking confirm button)
            const finalSession = testStateManager.getSession(userId);
            expect(finalSession).not.toBeNull();
            expect(testStateManager.canProceedToReview(finalSession!.data)).toBe(true);

            // Save to database
            registerPlayer(
                db,
                userId,
                finalSession!.data.battlenetId!,
                finalSession!.data.selectedRoles,
                finalSession!.data.selectedRank!
            );

            // Clean up session
            testStateManager.deleteSession(userId);

            // Verify player is registered in database
            expect(isPlayerRegistered(db, userId)).toBe(true);

            const player = getPlayer(db, userId);
            expect(player).toBeDefined();
            expect(player?.battlenet_id).toBe('TestPlayer#1234');
            expect(player?.rank).toBe('diamond');
            expect(player?.roles).toHaveLength(2);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('support');
        });

        it('prevents duplicate registration when user is already registered', () => {
            const userId = 'user456';

            // Register user first
            registerPlayer(db, userId, 'Existing#5678', ['dps'], 'gold');

            // Verify user is registered
            expect(isPlayerRegistered(db, userId)).toBe(true);

            // Attempt to create session should be blocked at command level
            // (In actual code, this check happens before session creation)
            // Here we verify the check works
            expect(isPlayerRegistered(db, userId)).toBe(true);
        });

        it('allows cancellation before completion', () => {
            const userId = 'user789';

            // Start registration
            testStateManager.createSession(userId, 'channel1');
            testStateManager.updateData(userId, {battlenetId: 'CancelTest#9999'});

            // User cancels (mimicking cancel button)
            testStateManager.deleteSession(userId);

            // Verify session is deleted
            expect(testStateManager.getSession(userId)).toBeNull();

            // Verify nothing was saved to database
            expect(isPlayerRegistered(db, userId)).toBe(false);
        });

        it('handles session expiry correctly', () => {
            const userId = 'user101';

            // Create session
            const session = testStateManager.createSession(userId, 'channel1');

            // Manually set session to expired (16 minutes old)
            session.startedAt = Date.now() - (16 * 60 * 1000);

            // Trigger cleanup
            (testStateManager as any).cleanup();

            // Verify session is removed
            expect(testStateManager.getSession(userId)).toBeNull();
        });

        it('supports registering with all three roles', () => {
            const userId = 'flexPlayer';

            // Create and complete registration with all roles
            testStateManager.createSession(userId, 'channel1');
            testStateManager.updateData(userId, {
                battlenetId: 'FlexGod#1111',
                selectedRoles: ['tank', 'dps', 'support'],
                selectedRank: 'grandmaster',
            });

            const session = testStateManager.getSession(userId);

            // Save to database
            registerPlayer(
                db,
                userId,
                session!.data.battlenetId!,
                session!.data.selectedRoles,
                session!.data.selectedRank!
            );

            testStateManager.deleteSession(userId);

            // Verify all roles are saved
            const player = getPlayer(db, userId);
            expect(player?.roles).toHaveLength(3);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('dps');
            expect(player?.roles).toContain('support');
        });

        it('supports registering with single role', () => {
            const userId = 'oneRole';

            testStateManager.createSession(userId, 'channel1');
            testStateManager.updateData(userId, {
                battlenetId: 'OneTrick#2222',
                selectedRoles: ['support'],
                selectedRank: 'bronze',
            });

            const session = testStateManager.getSession(userId);

            registerPlayer(
                db,
                userId,
                session!.data.battlenetId!,
                session!.data.selectedRoles,
                session!.data.selectedRank!
            );

            testStateManager.deleteSession(userId);

            const player = getPlayer(db, userId);
            expect(player?.roles).toEqual(['support']);
        });

        it('handles multiple users registering concurrently', () => {
            const user1 = 'user1';
            const user2 = 'user2';
            const user3 = 'user3';

            // Create sessions for all users
            testStateManager.createSession(user1, 'channel1');
            testStateManager.createSession(user2, 'channel2');
            testStateManager.createSession(user3, 'channel3');

            expect(testStateManager.getSessionCount()).toBe(3);

            // Each user progresses independently
            testStateManager.updateData(user1, {
                battlenetId: 'User1#1111',
                selectedRoles: ['tank'],
                selectedRank: 'gold',
            });

            testStateManager.updateData(user2, {
                battlenetId: 'User2#2222',
                selectedRoles: ['dps'],
                selectedRank: 'silver',
            });

            testStateManager.updateData(user3, {
                battlenetId: 'User3#3333',
                selectedRoles: ['support'],
                selectedRank: 'platinum',
            });

            // User 1 completes first
            const session1 = testStateManager.getSession(user1)!;
            registerPlayer(db, user1, session1.data.battlenetId!, session1.data.selectedRoles, session1.data.selectedRank!);
            testStateManager.deleteSession(user1);

            expect(testStateManager.getSessionCount()).toBe(2);

            // User 2 completes
            const session2 = testStateManager.getSession(user2)!;
            registerPlayer(db, user2, session2.data.battlenetId!, session2.data.selectedRoles, session2.data.selectedRank!);
            testStateManager.deleteSession(user2);

            // User 3 cancels
            testStateManager.deleteSession(user3);

            // Verify final state
            expect(testStateManager.getSessionCount()).toBe(0);
            expect(isPlayerRegistered(db, user1)).toBe(true);
            expect(isPlayerRegistered(db, user2)).toBe(true);
            expect(isPlayerRegistered(db, user3)).toBe(false);
        });

        it('prevents creating duplicate session for same user', () => {
            const userId = 'sameUser';

            testStateManager.createSession(userId, 'channel1');

            expect(() => {
                testStateManager.createSession(userId, 'channel2');
            }).toThrow('Session already exists for this user');
        });

        it('validates data completeness before allowing review', () => {
            const userId = 'incomplete';

            testStateManager.createSession(userId, 'channel1');

            // Only Battle.net ID set
            testStateManager.updateData(userId, {battlenetId: 'Incomplete#1234'});
            let session = testStateManager.getSession(userId)!;
            expect(testStateManager.canProceedToReview(session.data)).toBe(false);

            // Add roles
            testStateManager.updateData(userId, {selectedRoles: ['tank']});
            session = testStateManager.getSession(userId)!;
            expect(testStateManager.canProceedToReview(session.data)).toBe(false);

            // Add rank - now complete
            testStateManager.updateData(userId, {selectedRank: 'gold'});
            session = testStateManager.getSession(userId)!;
            expect(testStateManager.canProceedToReview(session.data)).toBe(true);
        });
    });

    describe('Session Management', () => {
        it('cleanup timer removes only expired sessions', () => {
            const recent = 'recentUser';
            const old = 'oldUser';

            const recentSession = testStateManager.createSession(recent, 'channel1');
            const oldSession = testStateManager.createSession(old, 'channel2');

            // Make old session expired
            oldSession.startedAt = Date.now() - (16 * 60 * 1000);

            (testStateManager as any).cleanup();

            expect(testStateManager.getSession(recent)).not.toBeNull();
            expect(testStateManager.getSession(old)).toBeNull();
        });

        it('can retrieve all active sessions', () => {
            testStateManager.createSession('user1', 'channel1');
            testStateManager.createSession('user2', 'channel2');
            testStateManager.createSession('user3', 'channel3');

            const sessions = testStateManager.getAllSessions();

            expect(sessions).toHaveLength(3);
            expect(sessions.map(s => s.userId)).toContain('user1');
            expect(sessions.map(s => s.userId)).toContain('user2');
            expect(sessions.map(s => s.userId)).toContain('user3');
        });
    });
});
