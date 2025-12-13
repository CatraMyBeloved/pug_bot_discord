import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import Database from 'better-sqlite3';
import {
    getLeaderboard,
    getPlayer,
    getPlayerRoles,
    getPlayerStats,
    isPlayerRegistered,
    registerPlayer,
    updatePlayer,
} from '../../../src/database/players';
import {completeMatch, createMatch, startMatch} from '../../../src/database/matches';
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

    describe('getPlayerStats', () => {
        beforeEach(() => {
            registerPlayer(db, 'user1', 'Player1#1234', ['tank', 'dps'], 'gold');
            registerPlayer(db, 'user2', 'Player2#5678', ['support'], 'silver');
            registerPlayer(db, 'user3', 'Player3#9999', ['tank'], 'diamond');
        });

        it('returns undefined for non-existent player', () => {
            const stats = getPlayerStats(db, 'nonexistent');

            expect(stats).toBeUndefined();
        });

        it('returns stats for player with no matches', () => {
            const stats = getPlayerStats(db, 'user1');

            expect(stats).toBeDefined();
            expect(stats?.totalGames).toBe(0);
            expect(stats?.winRate).toBe(0);
            expect(stats?.roleStats.tank).toBe(0);
            expect(stats?.roleStats.dps).toBe(0);
            expect(stats?.roleStats.support).toBe(0);
            expect(stats?.recentMatches).toEqual([]);
        });

        it('calculates correct win rate', () => {
            // Create and complete match with user1 winning
            const match1 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'support'},
            ]);
            startMatch(db, match1);
            completeMatch(db, match1, 1);

            const stats = getPlayerStats(db, 'user1');

            expect(stats?.totalGames).toBe(1);
            expect(stats?.winRate).toBe(100);
        });

        it('calculates correct role breakdown', () => {
            // Create matches with different roles
            const match1 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'support'},
            ]);
            completeMatch(db, match1, 1);

            const match2 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'support'},
            ]);
            completeMatch(db, match2, 1);

            const match3 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'dps'},
                {userId: 'user2', team: 2, assignedRole: 'support'},
            ]);
            completeMatch(db, match3, 2);

            const stats = getPlayerStats(db, 'user1');

            expect(stats?.roleStats.tank).toBe(2);
            expect(stats?.roleStats.dps).toBe(1);
            expect(stats?.roleStats.support).toBe(0);
        });

        it('returns recent matches in descending order', () => {
            // Create 3 matches
            for (let i = 0; i < 3; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                    {userId: 'user2', team: 2, assignedRole: 'support'},
                ]);
                completeMatch(db, matchId, 1);

                // Add delay between matches by updating completed_at
                if (i < 2) {
                    db.prepare(`
                        UPDATE matches
                        SET completed_at = datetime('now', '-${3 - i} hours')
                        WHERE match_id = ?
                    `).run(matchId);
                }
            }

            const stats = getPlayerStats(db, 'user1');

            expect(stats?.recentMatches).toHaveLength(3);
            // Most recent match should be first
            expect(stats!.recentMatches[0].matchId).toBeGreaterThan(stats!.recentMatches[1].matchId);
        });

        it('limits recent matches to specified count', () => {
            // Create 12 matches
            for (let i = 0; i < 12; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                    {userId: 'user2', team: 2, assignedRole: 'support'},
                ]);
                completeMatch(db, matchId, 1);
            }

            const stats = getPlayerStats(db, 'user1', 5);

            expect(stats?.recentMatches).toHaveLength(5);
        });

        it('correctly identifies won and lost matches', () => {
            const match1 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'support'},
            ]);
            completeMatch(db, match1, 1); // user1 wins

            // Make match1 older
            db.prepare(`
                UPDATE matches
                SET completed_at = datetime('now', '-1 hour')
                WHERE match_id = ?
            `).run(match1);

            const match2 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 2, assignedRole: 'dps'},
                {userId: 'user2', team: 1, assignedRole: 'support'},
            ]);
            completeMatch(db, match2, 1); // user1 loses

            const stats = getPlayerStats(db, 'user1');

            expect(stats?.recentMatches).toHaveLength(2);
            expect(stats?.recentMatches[0].wonMatch).toBe(false); // More recent loss
            expect(stats?.recentMatches[1].wonMatch).toBe(true);  // Earlier win
        });

        it('correctly identifies draw matches', () => {
            const matchId = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'support'},
            ]);
            completeMatch(db, matchId, null); // Draw

            const stats = getPlayerStats(db, 'user1');

            expect(stats?.recentMatches).toHaveLength(1);
            expect(stats?.recentMatches[0].isDraw).toBe(true);
            expect(stats?.recentMatches[0].wonMatch).toBe(false);
        });

        it('only counts completed matches', () => {
            // Create one completed match
            const match1 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
            ]);
            completeMatch(db, match1, 1);

            // Create one prepared match
            const match2 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'dps'},
            ]);

            const stats = getPlayerStats(db, 'user1');

            expect(stats?.roleStats.tank).toBe(1);
            expect(stats?.roleStats.dps).toBe(0); // Prepared match not counted
            expect(stats?.recentMatches).toHaveLength(1);
        });

        it('includes player info in stats', () => {
            const stats = getPlayerStats(db, 'user1');

            expect(stats?.player.discord_user_id).toBe('user1');
            expect(stats?.player.battlenet_id).toBe('Player1#1234');
            expect(stats?.player.rank).toBe('gold');
            expect(stats?.player.roles).toContain('tank');
            expect(stats?.player.roles).toContain('dps');
        });
    });

    describe('getLeaderboard', () => {
        beforeEach(() => {
            // Register 10 players
            for (let i = 1; i <= 10; i++) {
                registerPlayer(db, `user${i}`, `Player${i}#1234`, ['tank'], 'gold');
            }
        });

        it('returns empty array when no players meet min games', () => {
            const leaderboard = getLeaderboard(db, 25, 5);

            expect(leaderboard).toEqual([]);
        });

        it('sorts by activity-weighted score', () => {
            // user1: 5 wins, 0 losses (100% win rate, 5 games)
            for (let i = 0; i < 5; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                    {userId: 'user2', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, 1);
            }

            // user3: 6 wins, 0 losses (100% win rate, 6 games) - should be higher due to more games
            for (let i = 0; i < 6; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user3', team: 1, assignedRole: 'tank'},
                    {userId: 'user4', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, 1);
            }

            const leaderboard = getLeaderboard(db, 10, 3);

            expect(leaderboard[0].discordUserId).toBe('user3'); // 6 games, 100% wr
            expect(leaderboard[1].discordUserId).toBe('user1'); // 5 games, 100% wr
        });

        it('filters by minimum games', () => {
            // user1: 2 games (below minimum)
            for (let i = 0; i < 2; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                    {userId: 'user2', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, 1);
            }

            // user3: 5 games (meets minimum)
            for (let i = 0; i < 5; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user3', team: 1, assignedRole: 'tank'},
                    {userId: 'user4', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, 1);
            }

            const leaderboard = getLeaderboard(db, 10, 3);

            // Both user3 and user4 have 5 games, so both should be in leaderboard
            expect(leaderboard).toHaveLength(2);
            expect(leaderboard[0].discordUserId).toBe('user3'); // Higher score (wins)
            expect(leaderboard[1].discordUserId).toBe('user4'); // Lower score (losses)
        });

        it('respects limit parameter', () => {
            // Give 5 players some games
            for (let i = 1; i <= 5; i++) {
                for (let j = 0; j < 3; j++) {
                    const matchId = createMatch(db, 'vc123', [
                        {userId: `user${i}`, team: 1, assignedRole: 'tank'},
                        {userId: `user${i + 5}`, team: 2, assignedRole: 'tank'},
                    ]);
                    completeMatch(db, matchId, 1);
                }
            }

            const leaderboard = getLeaderboard(db, 3, 3);

            expect(leaderboard).toHaveLength(3);
        });

        it('calculates win rate correctly', () => {
            // user1: 3 wins, 2 losses (60% win rate)
            for (let i = 0; i < 5; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                    {userId: 'user2', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, i < 3 ? 1 : 2);
            }

            const leaderboard = getLeaderboard(db, 10, 3);

            const user1Entry = leaderboard.find(e => e.discordUserId === 'user1');
            expect(user1Entry?.wins).toBe(3);
            expect(user1Entry?.losses).toBe(2);
            expect(user1Entry?.totalGames).toBe(5);
            expect(user1Entry?.winRate).toBeCloseTo(60, 1);
        });

        it('handles edge case: 100% win rate with 1 game ranks below 60% with 10 games', () => {
            // user1: 1 win, 0 losses (100% win rate, 1 game)
            const match1 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user5', team: 2, assignedRole: 'tank'},
            ]);
            completeMatch(db, match1, 1);

            // user2: 6 wins, 4 losses (60% win rate, 10 games)
            for (let i = 0; i < 10; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user2', team: 1, assignedRole: 'tank'},
                    {userId: 'user6', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, i < 6 ? 1 : 2);
            }

            const leaderboard = getLeaderboard(db, 10, 1);

            // user2 should rank higher due to activity weighting
            expect(leaderboard[0].discordUserId).toBe('user2');
        });

        it('includes all required fields in leaderboard entry', () => {
            const matchId = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'tank'},
            ]);
            completeMatch(db, matchId, 1);

            const matchId2 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'tank'},
            ]);
            completeMatch(db, matchId2, 1);

            const matchId3 = createMatch(db, 'vc123', [
                {userId: 'user1', team: 2, assignedRole: 'tank'},
                {userId: 'user2', team: 1, assignedRole: 'tank'},
            ]);
            completeMatch(db, matchId3, 1);

            const leaderboard = getLeaderboard(db, 10, 1);

            const user1Entry = leaderboard.find(e => e.discordUserId === 'user1');
            expect(user1Entry).toHaveProperty('discordUserId');
            expect(user1Entry).toHaveProperty('battlenetId');
            expect(user1Entry).toHaveProperty('rank');
            expect(user1Entry).toHaveProperty('wins');
            expect(user1Entry).toHaveProperty('losses');
            expect(user1Entry).toHaveProperty('totalGames');
            expect(user1Entry).toHaveProperty('winRate');
            expect(user1Entry).toHaveProperty('score');
        });

        it('secondary sorts by total games when scores are tied', () => {
            // user1: 3 wins, 0 losses
            for (let i = 0; i < 3; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                    {userId: 'user5', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, 1);
            }

            // user2: 4 wins, 0 losses (same win rate, more games)
            for (let i = 0; i < 4; i++) {
                const matchId = createMatch(db, 'vc123', [
                    {userId: 'user2', team: 1, assignedRole: 'tank'},
                    {userId: 'user6', team: 2, assignedRole: 'tank'},
                ]);
                completeMatch(db, matchId, 1);
            }

            const leaderboard = getLeaderboard(db, 10, 3);

            // user2 should be first due to more games (higher score from log formula)
            expect(leaderboard[0].discordUserId).toBe('user2');
            expect(leaderboard[1].discordUserId).toBe('user1');
        });
    });
});
