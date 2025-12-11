import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import Database from 'better-sqlite3';
import {
    cancelScheduledPug,
    createScheduledPug,
    getPugsNeedingReminders,
    getScheduledPug,
    getUpcomingPugs,
    markReminderSent,
    updatePugState,
} from '../../../src/database/scheduled_pugs';
import {closeTestDatabase, createTestDatabase, getRowCount} from '../../setup/testUtils';

describe('Scheduled PUG Database Operations', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = createTestDatabase();
    });

    afterEach(() => {
        closeTestDatabase(db);
    });

    describe('createScheduledPug', () => {
        it('creates a scheduled PUG with Discord event', () => {
            const pugId = createScheduledPug(
                db,
                'guild123',
                '2025-12-25 18:00:00',
                'user1',
                'event123'
            );

            expect(pugId).toBeGreaterThan(0);
            expect(getRowCount(db, 'scheduled_pugs')).toBe(1);

            const pug = getScheduledPug(db, pugId);
            expect(pug).toBeDefined();
            expect(pug?.guild_id).toBe('guild123');
            expect(pug?.scheduled_time).toBe('2025-12-25 18:00:00');
            expect(pug?.created_by).toBe('user1');
            expect(pug?.discord_event_id).toBe('event123');
            expect(pug?.state).toBe('pending');
            expect(pug?.reminder_24h_sent).toBe(0);
            expect(pug?.reminder_1h_sent).toBe(0);
        });

        it('creates a scheduled PUG without Discord event', () => {
            const pugId = createScheduledPug(
                db,
                'guild123',
                '2025-12-25 18:00:00',
                'user1',
                null
            );

            const pug = getScheduledPug(db, pugId);
            expect(pug?.discord_event_id).toBeNull();
        });

        it('creates multiple PUGs with incrementing IDs', () => {
            const pug1 = createScheduledPug(db, 'guild1', '2025-12-25 18:00:00', 'user1', null);
            const pug2 = createScheduledPug(db, 'guild1', '2025-12-26 18:00:00', 'user1', null);
            const pug3 = createScheduledPug(db, 'guild2', '2025-12-27 18:00:00', 'user2', null);

            expect(pug2).toBe(pug1 + 1);
            expect(pug3).toBe(pug2 + 1);
            expect(getRowCount(db, 'scheduled_pugs')).toBe(3);
        });

        it('sets created_at timestamp', () => {
            const pugId = createScheduledPug(db, 'guild1', '2025-12-25 18:00:00', 'user1', null);
            const pug = getScheduledPug(db, pugId);

            expect(pug?.created_at).toBeDefined();
            expect(typeof pug?.created_at).toBe('string');
        });
    });

    describe('getScheduledPug', () => {
        it('returns undefined for non-existent PUG', () => {
            const pug = getScheduledPug(db, 999);
            expect(pug).toBeUndefined();
        });

        it('retrieves existing PUG by ID', () => {
            const pugId = createScheduledPug(db, 'guild1', '2025-12-25 18:00:00', 'user1', 'event1');
            const pug = getScheduledPug(db, pugId);

            expect(pug).toBeDefined();
            expect(pug?.pug_id).toBe(pugId);
            expect(pug?.guild_id).toBe('guild1');
        });
    });

    describe('getUpcomingPugs', () => {
        it('returns empty array when no PUGs exist', () => {
            const pugs = getUpcomingPugs(db, 'guild1');
            expect(pugs).toEqual([]);
        });

        it('returns only pending PUGs for specific guild', () => {
            createScheduledPug(db, 'guild1', '2025-12-25 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild1', '2025-12-26 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild2', '2025-12-27 18:00:00', 'user2', null);

            const guild1Pugs = getUpcomingPugs(db, 'guild1');
            expect(guild1Pugs).toHaveLength(2);
            expect(guild1Pugs.every(p => p.guild_id === 'guild1')).toBe(true);
            expect(guild1Pugs.every(p => p.state === 'pending')).toBe(true);
        });

        it('excludes cancelled PUGs', () => {
            const pug1 = createScheduledPug(db, 'guild1', '2025-12-25 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild1', '2025-12-26 18:00:00', 'user1', null);

            cancelScheduledPug(db, pug1);

            const pugs = getUpcomingPugs(db, 'guild1');
            expect(pugs).toHaveLength(1);
            expect(pugs[0].pug_id).not.toBe(pug1);
        });

        it('returns PUGs ordered by scheduled time', () => {
            createScheduledPug(db, 'guild1', '2025-12-27 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild1', '2025-12-25 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild1', '2025-12-26 18:00:00', 'user1', null);

            const pugs = getUpcomingPugs(db, 'guild1');
            expect(pugs).toHaveLength(3);
            expect(pugs[0].scheduled_time).toBe('2025-12-25 18:00:00');
            expect(pugs[1].scheduled_time).toBe('2025-12-26 18:00:00');
            expect(pugs[2].scheduled_time).toBe('2025-12-27 18:00:00');
        });
    });

    describe('getPugsNeedingReminders', () => {
        it('returns empty array when no PUGs exist', () => {
            const pugs = getPugsNeedingReminders(db);
            expect(pugs).toEqual([]);
        });

        it('returns only pending PUGs with future times', () => {
            // Future PUGs
            createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild1', '2099-12-26 18:00:00', 'user1', null);
            // Past PUG
            createScheduledPug(db, 'guild1', '2020-01-01 18:00:00', 'user1', null);

            const pugs = getPugsNeedingReminders(db);
            expect(pugs).toHaveLength(2);
            expect(pugs.every(p => p.state === 'pending')).toBe(true);
        });

        it('excludes cancelled PUGs', () => {
            const pug1 = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild1', '2099-12-26 18:00:00', 'user1', null);

            cancelScheduledPug(db, pug1);

            const pugs = getPugsNeedingReminders(db);
            expect(pugs).toHaveLength(1);
            expect(pugs[0].pug_id).not.toBe(pug1);
        });

        it('returns PUGs across all guilds', () => {
            createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);
            createScheduledPug(db, 'guild2', '2099-12-26 18:00:00', 'user2', null);
            createScheduledPug(db, 'guild3', '2099-12-27 18:00:00', 'user3', null);

            const pugs = getPugsNeedingReminders(db);
            expect(pugs).toHaveLength(3);
        });
    });

    describe('markReminderSent', () => {
        it('marks 24h reminder as sent', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);

            markReminderSent(db, pugId, '24h');

            const pug = getScheduledPug(db, pugId);
            expect(pug?.reminder_24h_sent).toBe(1);
            expect(pug?.reminder_1h_sent).toBe(0);
        });

        it('marks 1h reminder as sent', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);

            markReminderSent(db, pugId, '1h');

            const pug = getScheduledPug(db, pugId);
            expect(pug?.reminder_24h_sent).toBe(0);
            expect(pug?.reminder_1h_sent).toBe(1);
        });

        it('marks both reminders independently', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);

            markReminderSent(db, pugId, '24h');
            markReminderSent(db, pugId, '1h');

            const pug = getScheduledPug(db, pugId);
            expect(pug?.reminder_24h_sent).toBe(1);
            expect(pug?.reminder_1h_sent).toBe(1);
        });
    });

    describe('updatePugState', () => {
        it('updates PUG state', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);

            updatePugState(db, pugId, 'completed');

            const pug = getScheduledPug(db, pugId);
            expect(pug?.state).toBe('completed');
        });

        it('updates to various states', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);

            updatePugState(db, pugId, 'in_progress');
            expect(getScheduledPug(db, pugId)?.state).toBe('in_progress');

            updatePugState(db, pugId, 'cancelled');
            expect(getScheduledPug(db, pugId)?.state).toBe('cancelled');

            updatePugState(db, pugId, 'completed');
            expect(getScheduledPug(db, pugId)?.state).toBe('completed');
        });
    });

    describe('cancelScheduledPug', () => {
        it('sets PUG state to cancelled', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);

            cancelScheduledPug(db, pugId);

            const pug = getScheduledPug(db, pugId);
            expect(pug?.state).toBe('cancelled');
        });

        it('does not delete the PUG record', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);
            expect(getRowCount(db, 'scheduled_pugs')).toBe(1);

            cancelScheduledPug(db, pugId);

            expect(getRowCount(db, 'scheduled_pugs')).toBe(1);
            expect(getScheduledPug(db, pugId)).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('handles special characters in guild and user IDs', () => {
            const pugId = createScheduledPug(
                db,
                'guild-with-special_chars#123',
                '2099-12-25 18:00:00',
                'user_id!@#$%',
                null
            );

            const pug = getScheduledPug(db, pugId);
            expect(pug?.guild_id).toBe('guild-with-special_chars#123');
            expect(pug?.created_by).toBe('user_id!@#$%');
        });

        it('handles multiple operations on same PUG', () => {
            const pugId = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', 'event1');

            markReminderSent(db, pugId, '24h');
            const afterReminder = getScheduledPug(db, pugId);
            expect(afterReminder?.reminder_24h_sent).toBe(1);
            expect(afterReminder?.state).toBe('pending');

            markReminderSent(db, pugId, '1h');
            const afterSecondReminder = getScheduledPug(db, pugId);
            expect(afterSecondReminder?.reminder_1h_sent).toBe(1);
            expect(afterSecondReminder?.reminder_24h_sent).toBe(1);

            cancelScheduledPug(db, pugId);
            const afterCancel = getScheduledPug(db, pugId);
            expect(afterCancel?.state).toBe('cancelled');
            expect(afterCancel?.reminder_24h_sent).toBe(1);
            expect(afterCancel?.reminder_1h_sent).toBe(1);
        });

        it('handles concurrent PUGs for same guild', () => {
            const pug1 = createScheduledPug(db, 'guild1', '2099-12-25 18:00:00', 'user1', null);
            const pug2 = createScheduledPug(db, 'guild1', '2099-12-26 18:00:00', 'user1', null);
            const pug3 = createScheduledPug(db, 'guild1', '2099-12-27 18:00:00', 'user1', null);

            const pugs = getUpcomingPugs(db, 'guild1');
            expect(pugs).toHaveLength(3);

            cancelScheduledPug(db, pug2);

            const remainingPugs = getUpcomingPugs(db, 'guild1');
            expect(remainingPugs).toHaveLength(2);
            expect(remainingPugs.map(p => p.pug_id)).toEqual([pug1, pug3]);
        });
    });
});
