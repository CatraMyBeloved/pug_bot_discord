import {beforeEach, describe, expect, it} from '@jest/globals';
import {balanceTeamsBySkill} from '../../../src/utils/algorithms/rankBalancing';
import {Rank, RANK_VALUES} from '../../../src/types/matchmaking';
import {createSelectedPlayersForBalancing, resetUserIdCounter,} from '../../fixtures/players';

describe('balanceTeamsBySkill', () => {
    beforeEach(() => {
        resetUserIdCounter();
    });

    describe('Happy Path', () => {
        it('creates two teams with 5 players each', () => {
            const players = createSelectedPlayersForBalancing();

            const result = balanceTeamsBySkill(players);

            expect(result.team1).toHaveLength(5);
            expect(result.team2).toHaveLength(5);
        });

        it('maintains 1-2-2 role composition per team', () => {
            const players = createSelectedPlayersForBalancing();

            const result = balanceTeamsBySkill(players);

            for (const team of [result.team1, result.team2]) {
                expect(team.filter(p => p.assignedRole === 'tank')).toHaveLength(1);
                expect(team.filter(p => p.assignedRole === 'dps')).toHaveLength(2);
                expect(team.filter(p => p.assignedRole === 'support')).toHaveLength(2);
            }
        });

        it('creates teams with balanced ranks', () => {
            const players = createSelectedPlayersForBalancing([
                'grandmaster', 'grandmaster',
                'diamond', 'diamond', 'diamond', 'diamond',
                'gold', 'gold', 'silver', 'bronze'
            ]);

            const result = balanceTeamsBySkill(players);

            const team1Rank = result.team1.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);
            const team2Rank = result.team2.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);

            expect(Math.abs(team1Rank - team2Rank)).toBeLessThanOrEqual(2);
        });

        it('distributes all original players across teams', () => {
            const players = createSelectedPlayersForBalancing();

            const result = balanceTeamsBySkill(players);

            const allPlayerIds = [...result.team1, ...result.team2].map(p => p.userId);
            const originalIds = players.map(p => p.userId);

            expect(allPlayerIds).toHaveLength(10);
            expect(new Set(allPlayerIds).size).toBe(10);
            originalIds.forEach(id => {
                expect(allPlayerIds).toContain(id);
            });
        });

        it('preserves player data (rank, assignedRole, priorityScore)', () => {
            const players = createSelectedPlayersForBalancing();

            const result = balanceTeamsBySkill(players);

            const allPlayers = [...result.team1, ...result.team2];
            allPlayers.forEach(player => {
                const original = players.find(p => p.userId === player.userId);
                expect(original).toBeDefined();
                expect(player.rank).toBe(original!.rank);
                expect(player.assignedRole).toBe(original!.assignedRole);
                expect(player.priorityScore).toBe(original!.priorityScore);
            });
        });
    });

    describe('Balancing Quality', () => {
        it('distributes high-rank players evenly', () => {
            const players = createSelectedPlayersForBalancing([
                'grandmaster', 'grandmaster',
                'gold', 'gold', 'gold', 'gold',
                'silver', 'silver', 'silver', 'silver'
            ]);

            const result = balanceTeamsBySkill(players);

            const team1GMs = result.team1.filter(p => p.rank === 'grandmaster').length;
            const team2GMs = result.team2.filter(p => p.rank === 'grandmaster').length;

            expect(team1GMs).toBe(1);
            expect(team2GMs).toBe(1);
        });

        it('handles extreme rank differences', () => {
            const players = createSelectedPlayersForBalancing([
                'grandmaster', 'grandmaster',
                'master', 'master', 'master', 'master',
                'bronze', 'bronze', 'bronze', 'bronze'
            ]);

            const result = balanceTeamsBySkill(players);

            for (const team of [result.team1, result.team2]) {
                expect(team.filter(p => p.assignedRole === 'tank')).toHaveLength(1);
                expect(team.filter(p => p.assignedRole === 'dps')).toHaveLength(2);
                expect(team.filter(p => p.assignedRole === 'support')).toHaveLength(2);
            }
        });

        it('works with all players at same rank', () => {
            const players = createSelectedPlayersForBalancing(
                Array(10).fill('gold') as Rank[]
            );

            const result = balanceTeamsBySkill(players);

            const team1Rank = result.team1.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);
            const team2Rank = result.team2.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);

            expect(team1Rank).toBe(team2Rank);
        });

        it('minimizes rank difference with varied ranks', () => {
            const players = createSelectedPlayersForBalancing([
                'grandmaster', 'master',
                'diamond', 'platinum', 'gold', 'silver',
                'bronze', 'bronze', 'bronze', 'bronze'
            ]);

            const result = balanceTeamsBySkill(players);

            const team1Rank = result.team1.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);
            const team2Rank = result.team2.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);

            const totalRank = team1Rank + team2Rank;
            const avgRank = totalRank / 2;
            const maxDeviation = totalRank * 0.2;

            expect(Math.abs(team1Rank - avgRank)).toBeLessThan(maxDeviation);
            expect(Math.abs(team2Rank - avgRank)).toBeLessThan(maxDeviation);
        });
    });

    describe('Error Handling', () => {
        it('throws error when not exactly 10 players', () => {
            const players = createSelectedPlayersForBalancing().slice(0, 9);

            expect(() => balanceTeamsBySkill(players))
                .toThrow('Expected exactly 10 players, got 9');
        });

        it('throws error with too many players', () => {
            const players = [
                ...createSelectedPlayersForBalancing(),
                createSelectedPlayersForBalancing()[0],
            ];

            expect(() => balanceTeamsBySkill(players))
                .toThrow('Expected exactly 10 players, got 11');
        });

        it('throws error when impossible role composition', () => {
            const players = createSelectedPlayersForBalancing();
            players[0].assignedRole = 'tank';
            players[1].assignedRole = 'tank';
            players[2].assignedRole = 'tank';
            players[3].assignedRole = 'tank';
            players[4].assignedRole = 'tank';
            players[5].assignedRole = 'dps';
            players[6].assignedRole = 'dps';
            players[7].assignedRole = 'dps';
            players[8].assignedRole = 'dps';
            players[9].assignedRole = 'dps';

            expect(() => balanceTeamsBySkill(players))
                .toThrow('Cannot assign player with role');
        });
    });

    describe('Greedy Algorithm Behavior', () => {
        it('assigns highest-rank player to team with lower total first', () => {
            const players = createSelectedPlayersForBalancing([
                'grandmaster', 'bronze',
                'gold', 'gold', 'gold', 'gold',
                'silver', 'silver', 'silver', 'silver'
            ]);

            const result = balanceTeamsBySkill(players);

            const gmOnTeam1 = result.team1.some(p => p.rank === 'grandmaster');
            const gmOnTeam2 = result.team2.some(p => p.rank === 'grandmaster');

            expect(gmOnTeam1 || gmOnTeam2).toBe(true);
            expect(gmOnTeam1 && gmOnTeam2).toBe(false);
        });

        it('sorts players by rank descending before assignment', () => {
            const players = createSelectedPlayersForBalancing([
                'bronze', 'silver', 'gold', 'platinum', 'diamond',
                'bronze', 'silver', 'gold', 'platinum', 'master'
            ]);

            const result = balanceTeamsBySkill(players);

            const team1Rank = result.team1.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);
            const team2Rank = result.team2.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);

            expect(Math.abs(team1Rank - team2Rank)).toBeLessThanOrEqual(3);
        });
    });

    describe('Edge Cases', () => {
        it('handles all bronze ranks', () => {
            const players = createSelectedPlayersForBalancing(
                Array(10).fill('bronze') as Rank[]
            );

            const result = balanceTeamsBySkill(players);

            expect(result.team1).toHaveLength(5);
            expect(result.team2).toHaveLength(5);
        });

        it('handles all grandmaster ranks', () => {
            const players = createSelectedPlayersForBalancing(
                Array(10).fill('grandmaster') as Rank[]
            );

            const result = balanceTeamsBySkill(players);

            expect(result.team1).toHaveLength(5);
            expect(result.team2).toHaveLength(5);
        });

        it('handles alternating high and low ranks', () => {
            const players = createSelectedPlayersForBalancing([
                'grandmaster', 'bronze',
                'grandmaster', 'bronze',
                'master', 'bronze',
                'master', 'bronze',
                'diamond', 'bronze'
            ]);

            const result = balanceTeamsBySkill(players);

            const team1Rank = result.team1.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);
            const team2Rank = result.team2.reduce((sum, p) => sum + RANK_VALUES[p.rank], 0);

            expect(Math.abs(team1Rank - team2Rank)).toBeLessThanOrEqual(5);
        });

        it('preserves battlenetId and userId correctly', () => {
            const players = createSelectedPlayersForBalancing();

            const result = balanceTeamsBySkill(players);

            const allPlayers = [...result.team1, ...result.team2];
            allPlayers.forEach(player => {
                expect(player.userId).toBeTruthy();
                expect(player.battlenetId).toBeTruthy();
                expect(player.battlenetId).toContain('#');
            });
        });
    });

    describe('Role Constraints', () => {
        it('never exceeds role limits per team', () => {
            const players = createSelectedPlayersForBalancing();

            const result = balanceTeamsBySkill(players);

            for (const team of [result.team1, result.team2]) {
                expect(team.filter(p => p.assignedRole === 'tank').length).toBeLessThanOrEqual(1);
                expect(team.filter(p => p.assignedRole === 'dps').length).toBeLessThanOrEqual(2);
                expect(team.filter(p => p.assignedRole === 'support').length).toBeLessThanOrEqual(2);
            }
        });

        it('fills all role slots for both teams', () => {
            const players = createSelectedPlayersForBalancing();

            const result = balanceTeamsBySkill(players);

            for (const team of [result.team1, result.team2]) {
                expect(team.filter(p => p.assignedRole === 'tank')).toHaveLength(1);
                expect(team.filter(p => p.assignedRole === 'dps')).toHaveLength(2);
                expect(team.filter(p => p.assignedRole === 'support')).toHaveLength(2);
            }
        });
    });
});
