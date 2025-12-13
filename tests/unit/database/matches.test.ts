import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import Database from 'better-sqlite3';
import {
    cancelMatch,
    completeMatch,
    createMatch,
    getCurrentMatch,
    getLastPlayed,
    getLastPlayedForRole,
    getMatchParticipants,
    startMatch,
} from '../../../src/database/matches';
import {closeTestDatabase, createTestDatabase, getRowCount} from '../../setup/testUtils';
import {resetSeedPlayerCounter, seedGuildConfig, seedPlayers} from '../../fixtures/scenarios';

describe('Match Database Operations', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = createTestDatabase();
        resetSeedPlayerCounter();
        seedPlayers(db, 10, ['tank', 'dps', 'support'], 'gold');
    });

    afterEach(() => {
        closeTestDatabase(db);
    });

    describe('createMatch', () => {
        it('creates match in prepared state', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 1, assignedRole: 'dps'},
            ];

            const matchId = createMatch(db, 'vc123', participants);

            expect(matchId).toBeGreaterThan(0);
            expect(typeof matchId).toBe('number');
        });

        it('stores match with correct initial state', () => {
            const matchId = createMatch(db, 'vc123', []);

            const match = db.prepare('SELECT * FROM matches WHERE match_id = ?').get(matchId) as any;

            expect(match.state).toBe('prepared');
            expect(match.voice_channel_id).toBe('vc123');
            expect(match.winning_team).toBeNull();
            expect(match.completed_at).toBeNull();
        });

        it('creates match participants correctly', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 1, assignedRole: 'dps'},
                {userId: 'user3', team: 2, assignedRole: 'support'},
            ];

            const matchId = createMatch(db, 'vc123', participants);

            const storedParticipants = getMatchParticipants(db, matchId);
            expect(storedParticipants).toHaveLength(3);
        });

        it('stores participant details including team and assigned role', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'dps'},
            ];

            const matchId = createMatch(db, 'vc123', participants);

            const storedParticipants = getMatchParticipants(db, matchId);

            const participant1 = storedParticipants.find(p => p.discord_user_id === 'user1');
            expect(participant1?.team).toBe(1);
            expect(participant1?.assigned_role).toBe('tank');

            const participant2 = storedParticipants.find(p => p.discord_user_id === 'user2');
            expect(participant2?.team).toBe(2);
            expect(participant2?.assigned_role).toBe('dps');
        });

        it('associates voice channel with match', () => {
            const matchId = createMatch(db, 'vc456', []);

            const match = db.prepare('SELECT voice_channel_id FROM matches WHERE match_id = ?')
                .get(matchId) as any;

            expect(match.voice_channel_id).toBe('vc456');
        });

        it('creates match with full 10-player roster', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 1, assignedRole: 'dps'},
                {userId: 'user3', team: 1, assignedRole: 'dps'},
                {userId: 'user4', team: 1, assignedRole: 'support'},
                {userId: 'user5', team: 1, assignedRole: 'support'},
                {userId: 'user6', team: 2, assignedRole: 'tank'},
                {userId: 'user7', team: 2, assignedRole: 'dps'},
                {userId: 'user8', team: 2, assignedRole: 'dps'},
                {userId: 'user9', team: 2, assignedRole: 'support'},
                {userId: 'user10', team: 2, assignedRole: 'support'},
            ];

            const matchId = createMatch(db, 'vc123', participants);

            const storedParticipants = getMatchParticipants(db, matchId);
            expect(storedParticipants).toHaveLength(10);
        });

        it('sets created_at timestamp automatically', () => {
            const matchId = createMatch(db, 'vc123', []);

            const match = db.prepare('SELECT created_at FROM matches WHERE match_id = ?')
                .get(matchId) as any;

            expect(match.created_at).toBeDefined();
            expect(typeof match.created_at).toBe('string');
        });
    });

    describe('Match State Machine', () => {
        let matchId: number;

        beforeEach(() => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'tank'},
            ];
            matchId = createMatch(db, 'vc123', participants);
        });

        describe('startMatch', () => {
            it('transitions match from prepared to active', () => {
                startMatch(db, matchId);

                const match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.state).toBe('active');
            });

            it('does not modify other match fields', () => {
                const beforeMatch = db.prepare('SELECT * FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                startMatch(db, matchId);

                const afterMatch = db.prepare('SELECT * FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(afterMatch.voice_channel_id).toBe(beforeMatch.voice_channel_id);
                expect(afterMatch.created_at).toBe(beforeMatch.created_at);
                expect(afterMatch.winning_team).toBeNull();
                expect(afterMatch.completed_at).toBeNull();
            });
        });

        describe('completeMatch', () => {
            beforeEach(() => {
                startMatch(db, matchId);
            });

            it('marks match as complete with winning team', () => {
                completeMatch(db, matchId, 1);

                const match = db.prepare('SELECT * FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.state).toBe('complete');
                expect(match.winning_team).toBe(1);
            });

            it('sets completed_at timestamp', () => {
                completeMatch(db, matchId, 1);

                const match = db.prepare('SELECT completed_at FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.completed_at).toBeDefined();
                expect(typeof match.completed_at).toBe('string');
            });

            it('allows null winning team for draws', () => {
                completeMatch(db, matchId, null);

                const match = db.prepare('SELECT winning_team FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.winning_team).toBeNull();
            });

            it('accepts team 2 as winner', () => {
                completeMatch(db, matchId, 2);

                const match = db.prepare('SELECT winning_team FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.winning_team).toBe(2);
            });
        });

        describe('cancelMatch', () => {
            it('marks match as cancelled', () => {
                cancelMatch(db, matchId);

                const match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.state).toBe('cancelled');
            });

            it('sets completed_at timestamp even when cancelled', () => {
                cancelMatch(db, matchId);

                const match = db.prepare('SELECT completed_at FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.completed_at).toBeDefined();
                expect(typeof match.completed_at).toBe('string');
            });

            it('can cancel match in prepared state', () => {
                cancelMatch(db, matchId);

                const match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.state).toBe('cancelled');
            });

            it('can cancel match in active state', () => {
                startMatch(db, matchId);
                cancelMatch(db, matchId);

                const match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(matchId) as any;

                expect(match.state).toBe('cancelled');
            });
        });

        describe('State Transition Flow', () => {
            it('follows complete flow: prepared → active → complete', () => {
                let match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(matchId) as any;
                expect(match.state).toBe('prepared');

                startMatch(db, matchId);
                match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(matchId) as any;
                expect(match.state).toBe('active');

                completeMatch(db, matchId, 1);
                match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(matchId) as any;
                expect(match.state).toBe('complete');
            });

            it('allows cancellation at any point', () => {
                const match1Id = createMatch(db, 'vc123', []);
                cancelMatch(db, match1Id);
                let match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(match1Id) as any;
                expect(match.state).toBe('cancelled');

                const match2Id = createMatch(db, 'vc123', []);
                startMatch(db, match2Id);
                cancelMatch(db, match2Id);
                match = db.prepare('SELECT state FROM matches WHERE match_id = ?')
                    .get(match2Id) as any;
                expect(match.state).toBe('cancelled');
            });
        });
    });

    describe('getCurrentMatch', () => {
        beforeEach(() => {
            seedGuildConfig(db, 'guild123', 'vc123');
        });

        it('returns undefined when no matches exist', () => {
            const currentMatch = getCurrentMatch(db, 'guild123');

            expect(currentMatch).toBeUndefined();
        });

        it('returns prepared match for guild', () => {
            const matchId = createMatch(db, 'vc123', []);

            const currentMatch = getCurrentMatch(db, 'guild123');

            expect(currentMatch).toBeDefined();
            expect(currentMatch?.match_id).toBe(matchId);
            expect(currentMatch?.state).toBe('prepared');
        });

        it('returns active match for guild', () => {
            const matchId = createMatch(db, 'vc123', []);
            startMatch(db, matchId);

            const currentMatch = getCurrentMatch(db, 'guild123');

            expect(currentMatch).toBeDefined();
            expect(currentMatch?.match_id).toBe(matchId);
            expect(currentMatch?.state).toBe('active');
        });

        it('does not return completed match', () => {
            const matchId = createMatch(db, 'vc123', []);
            startMatch(db, matchId);
            completeMatch(db, matchId, 1);

            const currentMatch = getCurrentMatch(db, 'guild123');

            expect(currentMatch).toBeUndefined();
        });

        it('does not return cancelled match', () => {
            const matchId = createMatch(db, 'vc123', []);
            cancelMatch(db, matchId);

            const currentMatch = getCurrentMatch(db, 'guild123');

            expect(currentMatch).toBeUndefined();
        });

        it('returns most recent match when multiple exist', () => {
            const match1Id = createMatch(db, 'vc123', []);

            db.prepare(`
                UPDATE matches
                SET created_at = datetime('now', '-1 hour')
                WHERE match_id = ?
            `).run(match1Id);

            const match2Id = createMatch(db, 'vc123', []);

            const currentMatch = getCurrentMatch(db, 'guild123');

            expect(currentMatch?.match_id).toBe(match2Id);
        });

        it('returns match only for correct guild', () => {
            seedGuildConfig(db, 'guild456', 'vc456');

            createMatch(db, 'vc123', []);
            const match2Id = createMatch(db, 'vc456', []);

            const currentMatch = getCurrentMatch(db, 'guild456');

            expect(currentMatch?.match_id).toBe(match2Id);
        });
    });

    describe('getMatchParticipants', () => {
        it('returns empty array for match with no participants', () => {
            const matchId = createMatch(db, 'vc123', []);

            const participants = getMatchParticipants(db, matchId);

            expect(participants).toEqual([]);
        });

        it('returns participants with player details', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'dps'},
            ];
            const matchId = createMatch(db, 'vc123', participants);

            const result = getMatchParticipants(db, matchId);

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                match_id: matchId,
                discord_user_id: 'user1',
                team: 1,
                assigned_role: 'tank',
                battlenet_id: 'Player1#1234',
                rank: 'gold',
            });
        });

        it('orders participants by team then role', () => {
            const participants = [
                {userId: 'user5', team: 2, assignedRole: 'support'},
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user3', team: 1, assignedRole: 'support'},
                {userId: 'user4', team: 2, assignedRole: 'dps'},
            ];
            const matchId = createMatch(db, 'vc123', participants);

            const result = getMatchParticipants(db, matchId);

            expect(result[0].team).toBeLessThanOrEqual(result[1].team);
        });

        it('includes all participant fields', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
            ];
            const matchId = createMatch(db, 'vc123', participants);

            const result = getMatchParticipants(db, matchId);

            const participant = result[0];
            expect(participant).toHaveProperty('match_id');
            expect(participant).toHaveProperty('discord_user_id');
            expect(participant).toHaveProperty('team');
            expect(participant).toHaveProperty('assigned_role');
            expect(participant).toHaveProperty('battlenet_id');
            expect(participant).toHaveProperty('rank');
        });
    });

    describe('Priority Queries', () => {
        describe('getLastPlayed', () => {
            it('returns null for player who never played', () => {
                const lastPlayed = getLastPlayed(db, 'user1');

                expect(lastPlayed).toBeNull();
            });

            it('returns null for non-existent player', () => {
                const lastPlayed = getLastPlayed(db, 'nonexistent');

                expect(lastPlayed).toBeNull();
            });

            it('returns timestamp for player who completed a match', () => {
                const participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                    {userId: 'user2', team: 2, assignedRole: 'tank'},
                ];
                const matchId = createMatch(db, 'vc123', participants);
                startMatch(db, matchId);
                completeMatch(db, matchId, 1);

                const lastPlayed = getLastPlayed(db, 'user1');

                expect(lastPlayed).not.toBeNull();
                expect(typeof lastPlayed).toBe('string');
            });

            it('does not count incomplete matches', () => {
                const participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const matchId = createMatch(db, 'vc123', participants);
                startMatch(db, matchId); // Still active, not complete

                const lastPlayed = getLastPlayed(db, 'user1');

                expect(lastPlayed).toBeNull();
            });

            it('does not count cancelled matches', () => {
                const participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const matchId = createMatch(db, 'vc123', participants);
                cancelMatch(db, matchId);

                const lastPlayed = getLastPlayed(db, 'user1');

                expect(lastPlayed).toBeNull();
            });

            it('returns most recent match when player has multiple matches', () => {
                const match1Participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const match1Id = createMatch(db, 'vc123', match1Participants);
                completeMatch(db, match1Id, 1);

                db.prepare(`
                    UPDATE matches
                    SET created_at = datetime('now', '-10 days')
                    WHERE match_id = ?
                `).run(match1Id);

                const match2Participants = [
                    {userId: 'user1', team: 1, assignedRole: 'dps'},
                ];
                const match2Id = createMatch(db, 'vc123', match2Participants);
                completeMatch(db, match2Id, 1);

                const lastPlayed = getLastPlayed(db, 'user1');

                const match2Timestamp = db.prepare('SELECT created_at FROM matches WHERE match_id = ?')
                    .get(match2Id) as any;

                expect(lastPlayed).toBe(match2Timestamp.created_at);
            });

            it('returns timestamp regardless of role played', () => {
                const match1Participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const match1Id = createMatch(db, 'vc123', match1Participants);
                completeMatch(db, match1Id, 1);

                const lastPlayed = getLastPlayed(db, 'user1');

                expect(lastPlayed).not.toBeNull();
            });
        });

        describe('getLastPlayedForRole', () => {
            it('returns null for player who never played the role', () => {
                const lastPlayed = getLastPlayedForRole(db, 'user1', 'tank');

                expect(lastPlayed).toBeNull();
            });

            it('returns null for player who played different role', () => {
                const participants = [
                    {userId: 'user1', team: 1, assignedRole: 'dps'},
                ];
                const matchId = createMatch(db, 'vc123', participants);
                completeMatch(db, matchId, 1);

                const lastPlayed = getLastPlayedForRole(db, 'user1', 'tank');

                expect(lastPlayed).toBeNull();
            });

            it('returns timestamp for specific role', () => {
                const participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const matchId = createMatch(db, 'vc123', participants);
                completeMatch(db, matchId, 1);

                const lastPlayed = getLastPlayedForRole(db, 'user1', 'tank');

                expect(lastPlayed).not.toBeNull();
                expect(typeof lastPlayed).toBe('string');
            });

            it('filters by assigned_role correctly', () => {
                const match1Participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const match1Id = createMatch(db, 'vc123', match1Participants);
                completeMatch(db, match1Id, 1);

                db.prepare(`
                    UPDATE matches
                    SET created_at = datetime('now', '-1 hour')
                    WHERE match_id = ?
                `).run(match1Id);

                const match2Participants = [
                    {userId: 'user1', team: 1, assignedRole: 'dps'},
                ];
                const match2Id = createMatch(db, 'vc123', match2Participants);
                completeMatch(db, match2Id, 1);

                const lastPlayedTank = getLastPlayedForRole(db, 'user1', 'tank');
                const lastPlayedDps = getLastPlayedForRole(db, 'user1', 'dps');

                expect(lastPlayedTank).not.toBeNull();
                expect(lastPlayedDps).not.toBeNull();
                expect(lastPlayedTank).not.toBe(lastPlayedDps);
            });

            it('returns most recent match for specific role', () => {
                const match1Participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const match1Id = createMatch(db, 'vc123', match1Participants);
                completeMatch(db, match1Id, 1);
                db.prepare(`
                    UPDATE matches
                    SET created_at = datetime('now', '-10 days')
                    WHERE match_id = ?
                `).run(match1Id);

                const match2Participants = [
                    {userId: 'user1', team: 1, assignedRole: 'tank'},
                ];
                const match2Id = createMatch(db, 'vc123', match2Participants);
                completeMatch(db, match2Id, 1);

                const lastPlayed = getLastPlayedForRole(db, 'user1', 'tank');

                const match2Timestamp = db.prepare('SELECT created_at FROM matches WHERE match_id = ?')
                    .get(match2Id) as any;

                expect(lastPlayed).toBe(match2Timestamp.created_at);
            });
        });
    });

    describe('Edge Cases and Data Integrity', () => {
        it('handles multiple concurrent matches', () => {
            const match1Id = createMatch(db, 'vc123', []);
            const match2Id = createMatch(db, 'vc456', []);

            expect(match1Id).not.toBe(match2Id);
            expect(getRowCount(db, 'matches')).toBe(2);
        });

        it('preserves participant data across state changes', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 2, assignedRole: 'dps'},
            ];
            const matchId = createMatch(db, 'vc123', participants);

            startMatch(db, matchId);
            const afterStart = getMatchParticipants(db, matchId);

            completeMatch(db, matchId, 1);
            const afterComplete = getMatchParticipants(db, matchId);

            expect(afterStart).toHaveLength(2);
            expect(afterComplete).toHaveLength(2);
            expect(afterStart[0].discord_user_id).toBe(afterComplete[0].discord_user_id);
        });

        it('maintains referential integrity with players table', () => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
            ];
            const matchId = createMatch(db, 'vc123', participants);

            const result = getMatchParticipants(db, matchId);

            expect(result[0].battlenet_id).toBeDefined();
            expect(result[0].rank).toBeDefined();
            expect(result[0].battlenet_id).toBe('Player1#1234');
        });
    });

    describe('Win/Loss Tracking', () => {
        let matchId: number;

        beforeEach(() => {
            const participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 1, assignedRole: 'dps'},
                {userId: 'user3', team: 2, assignedRole: 'tank'},
                {userId: 'user4', team: 2, assignedRole: 'dps'},
            ];
            matchId = createMatch(db, 'vc123', participants);
            startMatch(db, matchId);
        });

        it('increments wins for winning team players', () => {
            completeMatch(db, matchId, 1);

            const user1 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user1') as any;
            const user2 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user2') as any;

            expect(user1.wins).toBe(1);
            expect(user2.wins).toBe(1);
        });

        it('increments losses for losing team players', () => {
            completeMatch(db, matchId, 1);

            const user3 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user3') as any;
            const user4 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user4') as any;

            expect(user3.losses).toBe(1);
            expect(user4.losses).toBe(1);
        });

        it('does not update stats for draw matches', () => {
            completeMatch(db, matchId, null);

            const user1 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user1') as any;
            const user3 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user3') as any;

            expect(user1.wins).toBe(0);
            expect(user1.losses).toBe(0);
            expect(user3.wins).toBe(0);
            expect(user3.losses).toBe(0);
        });

        it('handles team 2 victory correctly', () => {
            completeMatch(db, matchId, 2);

            const user1 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user1') as any;
            const user3 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user3') as any;

            expect(user1.losses).toBe(1);
            expect(user3.wins).toBe(1);
        });

        it('accumulates stats across multiple matches', () => {
            completeMatch(db, matchId, 1);

            // Create second match
            const match2Participants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user3', team: 2, assignedRole: 'tank'},
            ];
            const match2Id = createMatch(db, 'vc123', match2Participants);
            startMatch(db, match2Id);
            completeMatch(db, match2Id, 2);

            const user1 = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user1') as any;

            expect(user1.wins).toBe(1);
            expect(user1.losses).toBe(1);
        });

        it('updates stats atomically within transaction', () => {
            completeMatch(db, matchId, 1);

            // Verify match state and player stats are both updated
            const match = db.prepare('SELECT state, winning_team FROM matches WHERE match_id = ?')
                .get(matchId) as any;
            const user1 = db.prepare('SELECT wins FROM players WHERE discord_user_id = ?')
                .get('user1') as any;
            const user3 = db.prepare('SELECT losses FROM players WHERE discord_user_id = ?')
                .get('user3') as any;

            expect(match.state).toBe('complete');
            expect(match.winning_team).toBe(1);
            expect(user1.wins).toBe(1);
            expect(user3.losses).toBe(1);
        });

        it('correctly identifies losing team when team 1 wins', () => {
            completeMatch(db, matchId, 1);

            const team1Player = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user1') as any;
            const team2Player = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user3') as any;

            expect(team1Player.wins).toBe(1);
            expect(team1Player.losses).toBe(0);
            expect(team2Player.wins).toBe(0);
            expect(team2Player.losses).toBe(1);
        });

        it('correctly identifies losing team when team 2 wins', () => {
            completeMatch(db, matchId, 2);

            const team1Player = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user1') as any;
            const team2Player = db.prepare('SELECT wins, losses FROM players WHERE discord_user_id = ?')
                .get('user3') as any;

            expect(team1Player.wins).toBe(0);
            expect(team1Player.losses).toBe(1);
            expect(team2Player.wins).toBe(1);
            expect(team2Player.losses).toBe(0);
        });

        it('handles full 10-player match stats update', () => {
            const fullMatchParticipants = [
                {userId: 'user1', team: 1, assignedRole: 'tank'},
                {userId: 'user2', team: 1, assignedRole: 'dps'},
                {userId: 'user3', team: 1, assignedRole: 'dps'},
                {userId: 'user4', team: 1, assignedRole: 'support'},
                {userId: 'user5', team: 1, assignedRole: 'support'},
                {userId: 'user6', team: 2, assignedRole: 'tank'},
                {userId: 'user7', team: 2, assignedRole: 'dps'},
                {userId: 'user8', team: 2, assignedRole: 'dps'},
                {userId: 'user9', team: 2, assignedRole: 'support'},
                {userId: 'user10', team: 2, assignedRole: 'support'},
            ];
            const fullMatchId = createMatch(db, 'vc123', fullMatchParticipants);
            startMatch(db, fullMatchId);
            completeMatch(db, fullMatchId, 1);

            // Check that all 5 team 1 players have a win
            for (let i = 1; i <= 5; i++) {
                const player = db.prepare('SELECT wins FROM players WHERE discord_user_id = ?')
                    .get(`user${i}`) as any;
                expect(player.wins).toBe(1);
            }

            // Check that all 5 team 2 players have a loss
            for (let i = 6; i <= 10; i++) {
                const player = db.prepare('SELECT losses FROM players WHERE discord_user_id = ?')
                    .get(`user${i}`) as any;
                expect(player.losses).toBe(1);
            }
        });
    });
});
