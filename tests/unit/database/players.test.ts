import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import Database from 'better-sqlite3';
import {
    getPlayer,
    getPlayerRoles,
    isPlayerRegistered,
    registerPlayer,
    updatePlayer,
} from '../../../src/database/players';
import {closeTestDatabase, createTestDatabase, getRowCount} from '../../setup/testUtils';
import {resetSeedPlayerCounter} from '../../fixtures/scenarios';

describe('Player Database Operations', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = createTestDatabase();
        resetSeedPlayerCounter();
    });

    afterEach(() => {
        closeTestDatabase(db);
    });

    describe('registerPlayer', () => {
        it('creates player with single role', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['dps'], 'gold');

            const player = getPlayer(db, 'user1');

            expect(player).toBeDefined();
            expect(player?.battlenet_id).toBe('Player#1234');
            expect(player?.rank).toBe('gold');
            expect(player?.roles).toEqual(['dps']);
            expect(player?.wins).toBe(0);
            expect(player?.losses).toBe(0);
        });

        it('creates player with multiple roles', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'dps'], 'gold');

            const player = getPlayer(db, 'user1');

            expect(player).toBeDefined();
            expect(player?.roles).toHaveLength(2);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('dps');
        });

        it('creates player with all three roles', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'dps', 'support'], 'diamond');

            const player = getPlayer(db, 'user1');

            expect(player?.roles).toHaveLength(3);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('dps');
            expect(player?.roles).toContain('support');
        });

        it('stores roles in player_roles table', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'dps', 'support'], 'diamond');

            const roles = getPlayerRoles(db, 'user1');

            expect(roles).toHaveLength(3);
            expect(roles).toContain('tank');
            expect(roles).toContain('dps');
            expect(roles).toContain('support');
        });

        it('initializes wins and losses to 0', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['dps'], 'gold');

            const player = getPlayer(db, 'user1');

            expect(player?.wins).toBe(0);
            expect(player?.losses).toBe(0);
        });

        it('sets registered_at timestamp', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['dps'], 'gold');

            const player = getPlayer(db, 'user1');

            expect(player?.registered_at).toBeDefined();
            expect(typeof player?.registered_at).toBe('string');
        });

        it('creates multiple players independently', () => {
            registerPlayer(db, 'user1', 'Player1#1234', ['tank'], 'gold');
            registerPlayer(db, 'user2', 'Player2#5678', ['dps'], 'silver');

            expect(getRowCount(db, 'players')).toBe(2);
            expect(getPlayer(db, 'user1')?.battlenet_id).toBe('Player1#1234');
            expect(getPlayer(db, 'user2')?.battlenet_id).toBe('Player2#5678');
        });
    });

    describe('getPlayer', () => {
        it('returns undefined for non-existent player', () => {
            const player = getPlayer(db, 'nonexistent');

            expect(player).toBeUndefined();
        });

        it('retrieves player with all fields', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'dps'], 'master');

            const player = getPlayer(db, 'user1');

            expect(player).toMatchObject({
                discord_user_id: 'user1',
                battlenet_id: 'Player#1234',
                rank: 'master',
                wins: 0,
                losses: 0,
            });
            expect(player?.roles).toHaveLength(2);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('dps');
        });

        it('returns player with roles array attached', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['support'], 'platinum');

            const player = getPlayer(db, 'user1');

            expect(player?.roles).toBeDefined();
            expect(Array.isArray(player?.roles)).toBe(true);
        });
    });

    describe('getPlayerRoles', () => {
        it('returns empty array for non-existent player', () => {
            const roles = getPlayerRoles(db, 'nonexistent');

            expect(roles).toEqual([]);
        });

        it('returns all roles for player', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'support'], 'gold');

            const roles = getPlayerRoles(db, 'user1');

            expect(roles).toHaveLength(2);
            expect(roles).toContain('tank');
            expect(roles).toContain('support');
        });
    });

    describe('isPlayerRegistered', () => {
        it('returns false for non-existent player', () => {
            expect(isPlayerRegistered(db, 'nonexistent')).toBe(false);
        });

        it('returns true for registered player', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['dps'], 'gold');

            expect(isPlayerRegistered(db, 'user1')).toBe(true);
        });
    });

    describe('updatePlayer', () => {
        beforeEach(() => {
            registerPlayer(db, 'user1', 'OldTag#1234', ['dps'], 'silver');
        });

        it('updates battlenet_id', () => {
            updatePlayer(db, 'user1', 'NewTag#5678', undefined, undefined);

            const player = getPlayer(db, 'user1');
            expect(player?.battlenet_id).toBe('NewTag#5678');
            expect(player?.rank).toBe('silver'); // Unchanged
        });

        it('updates rank', () => {
            updatePlayer(db, 'user1', undefined, undefined, 'master');

            const player = getPlayer(db, 'user1');
            expect(player?.rank).toBe('master');
            expect(player?.battlenet_id).toBe('OldTag#1234'); // Unchanged
        });

        it('updates both battlenet_id and rank', () => {
            updatePlayer(db, 'user1', 'NewTag#5678', undefined, 'master');

            const player = getPlayer(db, 'user1');
            expect(player?.battlenet_id).toBe('NewTag#5678');
            expect(player?.rank).toBe('master');
        });

        it('updates roles by replacing all existing roles', () => {
            updatePlayer(db, 'user1', undefined, ['tank', 'support'], undefined);

            const player = getPlayer(db, 'user1');
            expect(player?.roles).toHaveLength(2);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('support');
        });

        it('updates battlenet_id, rank, and roles together', () => {
            updatePlayer(db, 'user1', 'NewTag#5678', ['tank', 'dps', 'support'], 'grandmaster');

            const player = getPlayer(db, 'user1');
            expect(player?.battlenet_id).toBe('NewTag#5678');
            expect(player?.rank).toBe('grandmaster');
            expect(player?.roles).toHaveLength(3);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('dps');
            expect(player?.roles).toContain('support');
        });

        it('does nothing when all parameters are undefined', () => {
            updatePlayer(db, 'user1', undefined, undefined, undefined);

            const player = getPlayer(db, 'user1');
            expect(player?.battlenet_id).toBe('OldTag#1234');
            expect(player?.rank).toBe('silver');
            expect(player?.roles).toEqual(['dps']);
        });

        it('removes old roles when updating to new ones', () => {
            updatePlayer(db, 'user1', undefined, ['support'], undefined);

            const roles = getPlayerRoles(db, 'user1');
            expect(roles).toEqual(['support']);
            expect(roles).not.toContain('dps');
        });

        it('preserves wins and losses', () => {
            db.prepare('UPDATE players SET wins = 5, losses = 3 WHERE discord_user_id = ?')
                .run('user1');

            updatePlayer(db, 'user1', 'NewTag#5678', ['tank'], 'master');

            const player = getPlayer(db, 'user1');
            expect(player?.wins).toBe(5);
            expect(player?.losses).toBe(3);
        });
    });

    describe('Foreign Key Constraints', () => {
        it('cascades delete from players to player_roles', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'dps'], 'gold');

            db.prepare('DELETE FROM players WHERE discord_user_id = ?').run('user1');

            const roles = getPlayerRoles(db, 'user1');
            expect(roles).toHaveLength(0);
        });

        it('deleting player removes all associated roles', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'dps', 'support'], 'gold');
            expect(getRowCount(db, 'player_roles')).toBe(3);

            db.prepare('DELETE FROM players WHERE discord_user_id = ?').run('user1');

            expect(getRowCount(db, 'player_roles')).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('handles special characters in battlenet_id', () => {
            registerPlayer(db, 'user1', 'Test-Player#1234', ['dps'], 'gold');

            const player = getPlayer(db, 'user1');
            expect(player?.battlenet_id).toBe('Test-Player#1234');
        });

        it('handles all rank types', () => {
            const ranks = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster'];

            ranks.forEach((rank, index) => {
                registerPlayer(db, `user${index}`, `Player${index}#1234`, ['dps'], rank);
            });

            ranks.forEach((rank, index) => {
                const player = getPlayer(db, `user${index}`);
                expect(player?.rank).toBe(rank);
            });
        });

        it('handles empty role updates', () => {
            registerPlayer(db, 'user1', 'Player#1234', ['tank', 'dps'], 'gold');

            updatePlayer(db, 'user1', undefined, [], undefined);

            const player = getPlayer(db, 'user1');
            expect(player?.roles).toHaveLength(2);
            expect(player?.roles).toContain('tank');
            expect(player?.roles).toContain('dps');
        });

        it('maintains data integrity with multiple operations', () => {
            registerPlayer(db, 'user1', 'Player1#1234', ['tank'], 'gold');
            registerPlayer(db, 'user2', 'Player2#5678', ['dps'], 'silver');
            updatePlayer(db, 'user1', 'UpdatedPlayer1#1234', ['support'], 'diamond');

            const player1 = getPlayer(db, 'user1');
            const player2 = getPlayer(db, 'user2');

            expect(player1?.battlenet_id).toBe('UpdatedPlayer1#1234');
            expect(player2?.battlenet_id).toBe('Player2#5678');
            expect(player1?.roles).toEqual(['support']);
            expect(player2?.roles).toEqual(['dps']);
        });
    });
});
