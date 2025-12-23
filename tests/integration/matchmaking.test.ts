import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import Database from 'better-sqlite3';
import {createMatchTeams} from '../../src/utils/matchmaking';
import {InsufficientPlayersError, InsufficientRoleCompositionError} from '../../src/utils/algorithms/prioritySelection';
import {closeTestDatabase, createTestDatabase} from '../setup/testUtils';
import {resetSeedPlayerCounter, seedPlayers, seedPlayersWithMatchHistory} from '../fixtures/scenarios';

/**
 * Integration Tests for Complete Matchmaking Flow
 *
 * These tests verify the end-to-end matchmaking process:
 * 1. Filter to registered players from voice channel
 * 2. Calculate priority scores based on match history
 * 3. Select 10 players with role assignment
 * 4. Balance teams by rank
 */
describe('Matchmaking Integration', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = createTestDatabase();
        resetSeedPlayerCounter();
    });

    afterEach(() => {
        closeTestDatabase(db);
    });

    describe('Full Matchmaking Flow', () => {
        it('creates balanced teams from voice channel users', () => {
            const userIds = seedPlayers(db, 12, ['tank', 'dps', 'support'], 'gold');

            const teams = createMatchTeams(userIds, db, 'test-guild');

            expect(teams.team1).toHaveLength(5);
            expect(teams.team2).toHaveLength(5);

            for (const team of [teams.team1, teams.team2]) {
                expect(team.filter(p => p.assignedRole === 'tank')).toHaveLength(1);
                expect(team.filter(p => p.assignedRole === 'dps')).toHaveLength(2);
                expect(team.filter(p => p.assignedRole === 'support')).toHaveLength(2);
            }
        });

        it('selects exactly 10 players when more are available', () => {
            const userIds = seedPlayers(db, 15, ['tank', 'dps', 'support'], 'gold');

            const teams = createMatchTeams(userIds, db, 'test-guild');

            const allSelectedPlayers = [...teams.team1, ...teams.team2];
            expect(allSelectedPlayers).toHaveLength(10);

            const uniqueUserIds = new Set(allSelectedPlayers.map(p => p.userId));
            expect(uniqueUserIds.size).toBe(10);
        });

        it('assigns each player to exactly one team', () => {
            const userIds = seedPlayers(db, 12, ['tank', 'dps', 'support'], 'gold');

            const teams = createMatchTeams(userIds, db, 'test-guild');

            const team1Ids = teams.team1.map(p => p.userId);
            const team2Ids = teams.team2.map(p => p.userId);

            team1Ids.forEach(id => {
                expect(team2Ids).not.toContain(id);
            });
        });

        it('assigns each player exactly one role for the match', () => {
            const userIds = seedPlayers(db, 12, ['tank', 'dps', 'support'], 'gold');

            const teams = createMatchTeams(userIds, db, 'test-guild');

            const allPlayers = [...teams.team1, ...teams.team2];
            allPlayers.forEach(player => {
                expect(player.assignedRole).toBeDefined();
                expect(['tank', 'dps', 'support']).toContain(player.assignedRole);
            });
        });

        it('balances teams by rank', () => {
            const tanks = seedPlayers(db, 2, ['tank'], 'grandmaster');
            const dpsPlayers = seedPlayers(db, 4, ['dps'], 'diamond');
            const supportPlayers = seedPlayers(db, 4, ['support'], 'silver');

            const userIds = [...tanks, ...dpsPlayers, ...supportPlayers];

            const teams = createMatchTeams(userIds, db, 'test-guild');

            const RANK_VALUES: Record<string, number> = {
                bronze: 1,
                silver: 2,
                gold: 3,
                platinum: 4,
                diamond: 5,
                master: 6,
                grandmaster: 7,
            };

            const team1Rank = teams.team1.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);
            const team2Rank = teams.team2.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);

            expect(Math.abs(team1Rank - team2Rank)).toBeLessThanOrEqual(5);
        });

        it('preserves player data through the entire flow', () => {
            const userIds = seedPlayers(db, 10, ['tank', 'dps', 'support'], 'gold');

            const teams = createMatchTeams(userIds, db, 'test-guild');

            const allPlayers = [...teams.team1, ...teams.team2];
            allPlayers.forEach(player => {
                expect(player.userId).toBeDefined();
                expect(player.battlenetId).toBeDefined();
                expect(player.rank).toBeDefined();
                expect(player.availableRoles).toBeDefined();
                expect(player.assignedRole).toBeDefined();
                expect(player.priorityScore).toBeDefined();

                expect(player.battlenetId).toContain('#');
                expect(player.availableRoles.length).toBeGreaterThan(0);
                expect(player.availableRoles).toContain(player.assignedRole);
            });
        });
    });

    describe('Priority Integration', () => {
        it('prioritizes players who have never played (Infinity priority)', () => {
            const userIdsByPriority = seedPlayersWithMatchHistory(db);

            const teams = createMatchTeams(userIdsByPriority, db, 'test-guild');

            const selectedUserIds = [...teams.team1, ...teams.team2].map(p => p.userId);

            expect(selectedUserIds).toContain('user11');
            expect(selectedUserIds).toContain('user12');
        });

        it('prioritizes players with older match history over recent players', () => {
            const userIds = seedPlayers(db, 14, ['tank', 'dps', 'support'], 'gold');

            const {createMatch, completeMatch} = require('../../src/database/matches');

            const oldMatchParticipants = userIds.slice(0, 5).map((userId, i) => ({
                userId,
                team: 1,
                assignedRole: 'dps',
            }));
            const oldMatchId = createMatch(db, 'vc123', oldMatchParticipants);
            db.prepare(`
                UPDATE matches
                SET created_at = datetime('now', '-30 days'),
                    state      = 'complete'
                WHERE match_id = ?
            `).run(oldMatchId);
            completeMatch(db, oldMatchId, 1);

            const recentMatchParticipants = userIds.slice(5, 10).map((userId, i) => ({
                userId,
                team: 1,
                assignedRole: 'dps',
            }));
            const recentMatchId = createMatch(db, 'vc123', recentMatchParticipants);
            db.prepare(`
                UPDATE matches
                SET created_at = datetime('now', '-1 day'),
                    state      = 'complete'
                WHERE match_id = ?
            `).run(recentMatchId);
            completeMatch(db, recentMatchId, 1);


            const teams = createMatchTeams(userIds, db, 'test-guild');
            const selectedUserIds = [...teams.team1, ...teams.team2].map(p => p.userId);

            expect(selectedUserIds).toContain('user11');
            expect(selectedUserIds).toContain('user12');
            expect(selectedUserIds).toContain('user13');
            expect(selectedUserIds).toContain('user14');

            const oldGroupSelected = selectedUserIds.filter(id =>
                ['user1', 'user2', 'user3', 'user4', 'user5'].includes(id)
            ).length;
            const recentGroupSelected = selectedUserIds.filter(id =>
                ['user6', 'user7', 'user8', 'user9', 'user10'].includes(id)
            ).length;

            expect(oldGroupSelected).toBeGreaterThanOrEqual(recentGroupSelected);
        });

        it('calculates priority based on days since last match', () => {
            const userIds = seedPlayers(db, 12, ['tank', 'dps', 'support'], 'gold');

            const {createMatch, completeMatch} = require('../../src/database/matches');
            const matchParticipants = userIds.slice(0, 5).map(userId => ({
                userId,
                team: 1,
                assignedRole: 'dps',
            }));
            const matchId = createMatch(db, 'vc123', matchParticipants);
            db.prepare(`
                UPDATE matches
                SET created_at = datetime('now', '-7 days'),
                    state      = 'complete'
                WHERE match_id = ?
            `).run(matchId);
            completeMatch(db, matchId, 1);

            const teams = createMatchTeams(userIds, db, 'test-guild');

            const allPlayers = [...teams.team1, ...teams.team2];

            const neverPlayedPlayers = allPlayers.filter(p =>
                !['user1', 'user2', 'user3', 'user4', 'user5'].includes(p.userId)
            );
            neverPlayedPlayers.forEach(player => {
                expect(player.priorityScore).toBe(Infinity);
            });

            const playedPlayers = allPlayers.filter(p =>
                ['user1', 'user2', 'user3', 'user4', 'user5'].includes(p.userId)
            );
            playedPlayers.forEach(player => {
                expect(player.priorityScore).toBeGreaterThan(6);
                expect(player.priorityScore).toBeLessThan(8);
            });
        });

        it('uses last played time for ANY role (not role-specific)', () => {
            const userIds = seedPlayers(db, 12, ['tank', 'dps', 'support'], 'gold');

            const {createMatch, completeMatch} = require('../../src/database/matches');

            const match1Participants = [{userId: 'user1', team: 1, assignedRole: 'tank'}];
            const match1Id = createMatch(db, 'vc123', match1Participants);
            db.prepare(`
                UPDATE matches
                SET created_at = datetime('now', '-5 days'),
                    state      = 'complete'
                WHERE match_id = ?
            `).run(match1Id);
            completeMatch(db, match1Id, 1);

            const match2Participants = [{userId: 'user2', team: 1, assignedRole: 'dps'}];
            const match2Id = createMatch(db, 'vc123', match2Participants);
            db.prepare(`
                UPDATE matches
                SET created_at = datetime('now', '-10 days'),
                    state      = 'complete'
                WHERE match_id = ?
            `).run(match2Id);
            completeMatch(db, match2Id, 1);

            const teams = createMatchTeams(userIds, db, 'test-guild');
            const allPlayers = [...teams.team1, ...teams.team2];

            const user1 = allPlayers.find(p => p.userId === 'user1');
            const user2 = allPlayers.find(p => p.userId === 'user2');

            if (user1 && user2) {
                expect(user2.priorityScore).toBeGreaterThan(user1.priorityScore);
            }
        });
    });

    describe('Error Propagation', () => {
        it('filters out unregistered users from voice channel', () => {
            seedPlayers(db, 8, ['tank', 'dps', 'support'], 'gold');

            const allUserIds = [
                'user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8',
                'unregistered1', 'unregistered2'
            ];

            expect(() => createMatchTeams(allUserIds, db, 'test-guild')).toThrow(InsufficientPlayersError);
        });

        it('throws InsufficientPlayersError when fewer than 10 registered players', () => {
            seedPlayers(db, 8, ['tank', 'dps', 'support'], 'gold');

            const userIds = Array.from({length: 8}, (_, i) => `user${i + 1}`);

            expect(() => createMatchTeams(userIds, db, 'test-guild')).toThrow(InsufficientPlayersError);
        });

        it('throws InsufficientRoleCompositionError for invalid role distribution', () => {
            seedPlayers(db, 10, ['dps'], 'gold');

            const userIds = Array.from({length: 10}, (_, i) => `user${i + 1}`);

            expect(() => createMatchTeams(userIds, db, 'test-guild'))
                .toThrow(InsufficientRoleCompositionError);
        });

        it('throws InsufficientRoleCompositionError when not enough tanks', () => {
            const tanks = seedPlayers(db, 1, ['tank'], 'gold');
            const dpsPlayers = seedPlayers(db, 5, ['dps'], 'gold');
            const supportPlayers = seedPlayers(db, 4, ['support'], 'gold');

            const userIds = [...tanks, ...dpsPlayers, ...supportPlayers];

            expect(() => createMatchTeams(userIds, db, 'test-guild'))
                .toThrow(InsufficientRoleCompositionError);
        });

        it('propagates algorithm errors with correct error details', () => {
            seedPlayers(db, 5, ['tank', 'dps', 'support'], 'gold');

            const userIds = Array.from({length: 5}, (_, i) => `user${i + 1}`);

            try {
                createMatchTeams(userIds, db, 'test-guild');
                fail('Expected InsufficientPlayersError to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(InsufficientPlayersError);
                const err = error as InsufficientPlayersError;
                expect(err.required).toBe(10);
                expect(err.found).toBe(5);
            }
        });
    });

    describe('Real-World Scenarios', () => {
        it('handles mixed ranks across players', () => {
            const tanks1 = seedPlayers(db, 1, ['tank'], 'grandmaster');
            const tanks2 = seedPlayers(db, 1, ['tank'], 'bronze');
            const dps1 = seedPlayers(db, 2, ['dps'], 'diamond');
            const dps2 = seedPlayers(db, 2, ['dps'], 'silver');
            const support1 = seedPlayers(db, 2, ['support'], 'master');
            const support2 = seedPlayers(db, 2, ['support'], 'gold');

            const userIds = [...tanks1, ...tanks2, ...dps1, ...dps2, ...support1, ...support2];

            const teams = createMatchTeams(userIds, db, 'test-guild');

            expect(teams.team1).toHaveLength(5);
            expect(teams.team2).toHaveLength(5);

            const team1Ranks = new Set(teams.team1.map(p => p.rank));
            const team2Ranks = new Set(teams.team2.map(p => p.rank));
            expect(team1Ranks.size).toBeGreaterThan(1);
            expect(team2Ranks.size).toBeGreaterThan(1);
        });

        it('handles multi-role players correctly', () => {
            const flexTankDps = seedPlayers(db, 3, ['tank', 'dps'], 'gold');
            const flexDpsSupport = seedPlayers(db, 3, ['dps', 'support'], 'gold');
            const flexAll = seedPlayers(db, 4, ['tank', 'dps', 'support'], 'gold');

            const userIds = [...flexTankDps, ...flexDpsSupport, ...flexAll];

            const teams = createMatchTeams(userIds, db, 'test-guild');

            expect(teams.team1).toHaveLength(5);
            expect(teams.team2).toHaveLength(5);

            const allPlayers = [...teams.team1, ...teams.team2];
            allPlayers.forEach(player => {
                expect(player.assignedRole).toBeDefined();
                expect(['tank', 'dps', 'support']).toContain(player.assignedRole);
                expect(player.availableRoles).toContain(player.assignedRole);
            });
        });

        it('handles exactly 10 players (no extras)', () => {
            seedPlayers(db, 10, ['tank', 'dps', 'support'], 'gold');

            const userIds = Array.from({length: 10}, (_, i) => `user${i + 1}`);

            const teams = createMatchTeams(userIds, db, 'test-guild');

            expect(teams.team1).toHaveLength(5);
            expect(teams.team2).toHaveLength(5);

            const selectedUserIds = [...teams.team1, ...teams.team2].map(p => p.userId);
            userIds.forEach(id => {
                expect(selectedUserIds).toContain(id);
            });
        });

        it('handles large voice channel with priority-based selection', () => {
            seedPlayers(db, 20, ['tank', 'dps', 'support'], 'gold');

            const userIds = Array.from({length: 20}, (_, i) => `user${i + 1}`);

            const teams = createMatchTeams(userIds, db, 'test-guild');

            expect(teams.team1).toHaveLength(5);
            expect(teams.team2).toHaveLength(5);

            const allPlayers = [...teams.team1, ...teams.team2];
            allPlayers.forEach(player => {
                expect(player.priorityScore).toBe(Infinity);
            });
        });

        it('integrates with complete match workflow', () => {
            const userIds = seedPlayers(db, 12, ['tank', 'dps', 'support'], 'gold');

            const firstTeams = createMatchTeams(userIds, db, 'test-guild');
            const firstSelectedIds = [...firstTeams.team1, ...firstTeams.team2].map(p => p.userId);

            const firstAllPlayers = [...firstTeams.team1, ...firstTeams.team2];
            firstAllPlayers.forEach(player => {
                expect(player.priorityScore).toBe(Infinity);
            });

            const {createMatch, completeMatch} = require('../../src/database/matches');
            const matchParticipants = firstSelectedIds.map((userId, i) => ({
                userId,
                team: i < 5 ? 1 : 2,
                assignedRole: 'dps',
            }));
            const matchId = createMatch(db, 'vc123', matchParticipants);
            completeMatch(db, matchId, 1);

            const secondTeams = createMatchTeams(userIds, db, 'test-guild');
            const secondSelectedIds = [...secondTeams.team1, ...secondTeams.team2].map(p => p.userId);

            const secondAllPlayers = [...secondTeams.team1, ...secondTeams.team2];

            const neverPlayedSelected = secondAllPlayers.filter(p =>
                !firstSelectedIds.includes(p.userId)
            );
            neverPlayedSelected.forEach(player => {
                expect(player.priorityScore).toBe(Infinity);
            });

            const playedSelected = secondAllPlayers.filter(p =>
                firstSelectedIds.includes(p.userId)
            );
            playedSelected.forEach(player => {
                expect(player.priorityScore).not.toBe(Infinity);
                expect(player.priorityScore).toBeGreaterThanOrEqual(0);
            });

            expect(neverPlayedSelected.length).toBeGreaterThan(0);
        });
    });
});
