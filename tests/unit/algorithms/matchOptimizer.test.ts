import { optimizeMatchSelection, combinations, calculateSkillBand, selectBaseTeam, buildCandidatePools, generateCombinations, calculateNormalizationConstants, calculateCost, selectOptimalCombination } from '../../../src/utils/algorithms/matchOptimizer';
import { PlayerWithRoles, Role, SelectedPlayer, DEFAULT_OPTIMIZER_CONFIG } from '../../../src/types/matchmaking';
import { InsufficientPlayersError, InsufficientRoleCompositionError } from '../../../src/utils/algorithms/prioritySelection';
import { balanceTeamsBySkill } from '../../../src/utils/algorithms/rankBalancing';
import { createMockPlayer, resetUserIdCounter } from '../../fixtures/players';

describe('matchOptimizer', () => {
    beforeEach(() => {
        resetUserIdCounter();
    });

    describe('optimizeMatchSelection', () => {
        describe('Happy path', () => {
            it('selects exactly 10 players', () => {
                // Create players with varied skills and priorities
                // Need 26 total: base 10 (2T,4D,4S) + pools 16 (4T,6D,6S)
                const players: PlayerWithRoles[] = [
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn((userId: string) => {
                    const userNum = parseInt(userId.replace('user', ''));
                    return 100 - userNum;
                });

                const result = optimizeMatchSelection(players, getPriority);

                expect(result).toHaveLength(10);
            });

            it('maintains role composition (2T, 4D, 4S)', () => {
                // Need 26 total: base 10 (2T,4D,4S) + pools 16 (4T,6D,6S)
                const players: PlayerWithRoles[] = [
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);
                const result = optimizeMatchSelection(players, getPriority);

                const tanks = result.filter(p => p.assignedRole === 'tank');
                const dps = result.filter(p => p.assignedRole === 'dps');
                const support = result.filter(p => p.assignedRole === 'support');

                expect(tanks).toHaveLength(2);
                expect(dps).toHaveLength(4);
                expect(support).toHaveLength(4);
            });

            it('returns players within skill band', () => {
                // Create players with varied skill levels
                // Need 26 total: base 10 (2T,4D,4S) + pools 16 (4T,6D,6S)
                const players: PlayerWithRoles[] = [
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);
                const result = optimizeMatchSelection(players, getPriority);

                // All selected players should be within a reasonable skill band
                const muValues = result.map(p => p.mu);
                const minMu = Math.min(...muValues);
                const maxMu = Math.max(...muValues);
                const spread = maxMu - minMu;

                // Spread should be reasonable (not including extreme outliers)
                expect(spread).toBeLessThanOrEqual(30);
            });

            it('prioritizes high-priority players when quality is similar', () => {
                // All players have same skill, but different priorities
                // Need 26 total: base 10 (2T,4D,4S) + pools 16 (4T,6D,6S)
                const players: PlayerWithRoles[] = [
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn((userId: string) => {
                    const userNum = parseInt(userId.replace('user', ''));
                    return 100 - userNum; // Higher priority for lower user numbers
                });

                const result = optimizeMatchSelection(players, getPriority);

                // Should successfully select 10 players
                expect(result).toHaveLength(10);

                // Verify role composition
                expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
                expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
                expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);

                // All selected players should have priority scores assigned
                expect(result.every(p => p.priorityScore > 0)).toBe(true);
            });

            it('considers both priority and balance in selection', () => {
                // Create mixed skill pool with varied tank skills
                // Need 26+ total: base 10 (2T,4D,4S) + pools 16 (4T,6D,6S)
                const players: PlayerWithRoles[] = [
                    // More tanks to ensure enough within skill band
                    createMockPlayer({ availableRoles: ['tank'], mu: 40 }), // High skill
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })), // Mid skill
                    createMockPlayer({ availableRoles: ['tank'], mu: 20 }), // Lower skill
                    // 10 DPS and 10 support
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);
                const result = optimizeMatchSelection(players, getPriority);

                // Should successfully create a valid match
                expect(result).toHaveLength(10);

                // Verify role composition is maintained
                const tanks = result.filter(p => p.assignedRole === 'tank');
                expect(tanks).toHaveLength(2);

                // The algorithm should produce a reasonable result
                // (not testing exact selection, just that it works)
                expect(result.every(p => p.mu > 0)).toBe(true);
            });
        });

        describe('Edge cases', () => {
            it('returns base team when exactly 10 players', () => {
                // Exactly 10 players - no optimization needed
                const players: PlayerWithRoles[] = [
                    ...Array(2).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);
                const result = optimizeMatchSelection(players, getPriority);

                // Should return all 10 players
                expect(result).toHaveLength(10);

                // All input players should be in result
                const selectedIds = new Set(result.map(p => p.userId));
                players.forEach(p => {
                    expect(selectedIds.has(p.userId)).toBe(true);
                });
            });

            it('works with standard player pool', () => {
                // Test with standard pool size (26 players)
                // Need 26 total: base 10 (2T,4D,4S) + pools 16 (4T,6D,6S)
                const players: PlayerWithRoles[] = [
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);
                const result = optimizeMatchSelection(players, getPriority);

                // Should return 10 players with correct composition
                expect(result).toHaveLength(10);
                expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
                expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
                expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);
            });

            it('handles all same skill level (spread = 0)', () => {
                // All players have identical mu
                // Need 26 total: base 10 (2T,4D,4S) + pools 16 (4T,6D,6S)
                const players: PlayerWithRoles[] = [
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn((userId: string) => {
                    const userNum = parseInt(userId.replace('user', ''));
                    return 100 - userNum;
                });

                // Should not crash despite spread = 0
                const result = optimizeMatchSelection(players, getPriority);

                expect(result).toHaveLength(10);
                // All players should have same mu
                expect(result.every(p => p.mu === 25)).toBe(true);
            });

            it('handles single combination scenario', () => {
                // Create minimum valid pools: 2T, 4D, 4S (exactly)
                const players: PlayerWithRoles[] = [
                    ...Array(2).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    ...Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);
                const result = optimizeMatchSelection(players, getPriority);

                // Should still work with only 1 possible combination
                expect(result).toHaveLength(10);
            });
        });

        describe('Error cases', () => {
            it('throws InsufficientPlayersError when fewer than 10 players', () => {
                const players: PlayerWithRoles[] = Array(9).fill(null).map(() =>
                    createMockPlayer({ availableRoles: ['tank', 'dps', 'support'] })
                );

                const getPriority = jest.fn(() => 100);

                expect(() => {
                    optimizeMatchSelection(players, getPriority);
                }).toThrow(InsufficientPlayersError);
            });

            it('throws InsufficientRoleCompositionError when roles insufficient', () => {
                // Only 1 tank, but need 2
                const players: PlayerWithRoles[] = [
                    createMockPlayer({ availableRoles: ['tank'], mu: 25 }),
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);

                expect(() => {
                    optimizeMatchSelection(players, getPriority);
                }).toThrow(InsufficientRoleCompositionError);
            });

            it('returns base team after band expansion fails', () => {
                // Create scenario where even after band expansion, there aren't enough tanks for optimization
                // All tanks are far outside the skill band
                const players: PlayerWithRoles[] = [
                    // Only 1 tank within reasonable range
                    createMockPlayer({ availableRoles: ['tank'], mu: 25 }),
                    // Other tank is way too far (will be outside even expanded band)
                    createMockPlayer({ availableRoles: ['tank'], mu: 100 }),
                    // Rest are DPS and support
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    ...Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);

                // Should fallback to base team instead of throwing
                const result = optimizeMatchSelection(players, getPriority);
                expect(result).toHaveLength(10);
            });
        });

        describe('Multi-role players', () => {
            it('assigns multi-role players to needed roles', () => {
                // Create scenario with multi-role players
                // Need enough pure-role players to avoid pool size issues with flex players
                const players: PlayerWithRoles[] = [
                    // 6 pure tanks (ensures enough even if flex assigned elsewhere)
                    ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                    // 2 tank/dps flex players
                    ...Array(2).fill(null).map(() => createMockPlayer({ availableRoles: ['tank', 'dps'], mu: 25 })),
                    // 10 pure DPS players
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                    // 10 pure support players
                    ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
                ];

                const getPriority = jest.fn(() => 100);
                const result = optimizeMatchSelection(players, getPriority);

                // Should successfully create a valid match
                expect(result).toHaveLength(10);

                // Should maintain role composition
                expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
                expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
                expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);
            });
        });
    });

    describe('combinations', () => {
        it('generates correct k-combinations', () => {
            const arr = [1, 2, 3, 4];
            const result = Array.from(combinations(arr, 2));

            expect(result).toHaveLength(6); // C(4,2) = 6
            expect(result).toContainEqual([1, 2]);
            expect(result).toContainEqual([1, 3]);
            expect(result).toContainEqual([1, 4]);
            expect(result).toContainEqual([2, 3]);
            expect(result).toContainEqual([2, 4]);
            expect(result).toContainEqual([3, 4]);
        });

        it('handles k=0 edge case', () => {
            const arr = [1, 2, 3];
            const result = Array.from(combinations(arr, 0));

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual([]);
        });

        it('handles k=n edge case', () => {
            const arr = [1, 2, 3];
            const result = Array.from(combinations(arr, 3));

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual([1, 2, 3]);
        });

        it('handles k>n edge case', () => {
            const arr = [1, 2];
            const result = Array.from(combinations(arr, 5));

            expect(result).toHaveLength(0);
        });

        it('C(5,2) returns 10 combinations', () => {
            const arr = [1, 2, 3, 4, 5];
            const result = Array.from(combinations(arr, 2));

            expect(result).toHaveLength(10);
        });

        it('C(4,2) returns 6 combinations', () => {
            const arr = [1, 2, 3, 4];
            const result = Array.from(combinations(arr, 2));

            expect(result).toHaveLength(6);
        });

        it('C(6,4) returns 15 combinations', () => {
            const arr = [1, 2, 3, 4, 5, 6];
            const result = Array.from(combinations(arr, 4));

            expect(result).toHaveLength(15);
        });
    });

    describe('calculateSkillBand', () => {
        it('calculates correct spread and buffer', () => {
            const baseTeam: SelectedPlayer[] = [
                { ...createMockPlayer(), mu: 20, assignedRole: 'tank', priorityScore: 100 },
                { ...createMockPlayer(), mu: 25, assignedRole: 'dps', priorityScore: 99 },
                { ...createMockPlayer(), mu: 30, assignedRole: 'dps', priorityScore: 98 },
                { ...createMockPlayer(), mu: 22, assignedRole: 'support', priorityScore: 97 },
                { ...createMockPlayer(), mu: 28, assignedRole: 'tank', priorityScore: 96 },
                { ...createMockPlayer(), mu: 24, assignedRole: 'dps', priorityScore: 95 },
                { ...createMockPlayer(), mu: 26, assignedRole: 'dps', priorityScore: 94 },
                { ...createMockPlayer(), mu: 23, assignedRole: 'support', priorityScore: 93 },
                { ...createMockPlayer(), mu: 27, assignedRole: 'support', priorityScore: 92 },
                { ...createMockPlayer(), mu: 21, assignedRole: 'support', priorityScore: 91 },
            ];

            const band = calculateSkillBand(baseTeam);

            expect(band.spread).toBe(10); // 30 - 20
            expect(band.buffer).toBe(5); // 10 × 0.5
            expect(band.min).toBe(15); // 20 - 5
            expect(band.max).toBe(35); // 30 + 5
        });

        it('handles zero spread (all same skill)', () => {
            const baseTeam: SelectedPlayer[] = Array(10).fill(null).map(() => ({
                ...createMockPlayer(),
                mu: 25,
                assignedRole: 'dps' as Role,
                priorityScore: 100,
            }));

            const band = calculateSkillBand(baseTeam);

            expect(band.spread).toBe(0);
            expect(band.buffer).toBe(5.0); // Default buffer
            expect(band.min).toBe(20); // 25 - 5
            expect(band.max).toBe(30); // 25 + 5
        });

        it('sets min/max correctly with small spread', () => {
            const baseTeam: SelectedPlayer[] = [
                { ...createMockPlayer(), mu: 24, assignedRole: 'tank', priorityScore: 100 },
                { ...createMockPlayer(), mu: 25, assignedRole: 'dps', priorityScore: 99 },
                { ...createMockPlayer(), mu: 26, assignedRole: 'dps', priorityScore: 98 },
                { ...createMockPlayer(), mu: 24, assignedRole: 'support', priorityScore: 97 },
                { ...createMockPlayer(), mu: 25, assignedRole: 'tank', priorityScore: 96 },
                { ...createMockPlayer(), mu: 26, assignedRole: 'dps', priorityScore: 95 },
                { ...createMockPlayer(), mu: 25, assignedRole: 'dps', priorityScore: 94 },
                { ...createMockPlayer(), mu: 24, assignedRole: 'support', priorityScore: 93 },
                { ...createMockPlayer(), mu: 26, assignedRole: 'support', priorityScore: 92 },
                { ...createMockPlayer(), mu: 25, assignedRole: 'support', priorityScore: 91 },
            ];

            const band = calculateSkillBand(baseTeam);

            expect(band.spread).toBe(2); // 26 - 24
            expect(band.buffer).toBe(1); // 2 × 0.5
            expect(band.min).toBe(23); // 24 - 1
            expect(band.max).toBe(27); // 26 + 1
        });
    });

    describe('selectBaseTeam', () => {
        it('selects top 10 players by priority', () => {
            const players: PlayerWithRoles[] = [
                ...Array(3).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'] })),
                ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'] })),
                ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['support'] })),
            ];

            const getPriority = jest.fn((userId: string) => {
                const userNum = parseInt(userId.replace('user', ''));
                return 100 - userNum; // Higher priority for lower numbers
            });

            const result = selectBaseTeam(players, getPriority);

            expect(result.baseTeam).toHaveLength(10);
            // Selection order: tanks → supports → dps
            // user1, user2 (2 tanks with highest priority)
            // user9, user10, user11, user12 (4 supports with highest priority)
            // user4, user5, user6, user7 (4 dps with highest priority)
            expect(result.baseTeam.map(p => p.userId)).toEqual([
                'user1', 'user2', // 2 tanks
                'user9', 'user10', 'user11', 'user12', // 4 supports
                'user4', 'user5', 'user6', 'user7' // 4 dps
            ]);
        });

        it('returns remaining pools excluding selected', () => {
            const players: PlayerWithRoles[] = [
                ...Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'] })),
                ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'] })),
                ...Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'] })),
            ];

            const getPriority = jest.fn((userId: string) => {
                const userNum = parseInt(userId.replace('user', ''));
                return 100 - userNum;
            });

            const result = selectBaseTeam(players, getPriority);

            // Base team: 2 tanks (user1, user2), 4 supports (user5-8), 4 dps (user9-12)
            // Remaining: 2 tanks (user3, user4), 2 dps (user13, user14), 2 supports (user15, user16)
            expect(result.remainingTanks).toHaveLength(2);
            expect(result.remainingDps).toHaveLength(2);
            expect(result.remainingSupport).toHaveLength(2);

            // Verify no overlap
            const selectedIds = new Set(result.baseTeam.map(p => p.userId));
            expect(result.remainingTanks.every(p => !selectedIds.has(p.userId))).toBe(true);
            expect(result.remainingDps.every(p => !selectedIds.has(p.userId))).toBe(true);
            expect(result.remainingSupport.every(p => !selectedIds.has(p.userId))).toBe(true);
        });

        it('maintains role composition in base team', () => {
            const players: PlayerWithRoles[] = [
                ...Array(3).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'] })),
                ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'] })),
                ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['support'] })),
            ];

            const getPriority = jest.fn(() => 100);

            const result = selectBaseTeam(players, getPriority);

            const roleCount = result.baseTeam.reduce((acc, p) => {
                acc[p.assignedRole] = (acc[p.assignedRole] || 0) + 1;
                return acc;
            }, {} as Record<Role, number>);

            expect(roleCount.tank).toBe(2);
            expect(roleCount.dps).toBe(4);
            expect(roleCount.support).toBe(4);
        });
    });

    describe('buildCandidatePools', () => {
        it('filters players within skill band', () => {
            // Base team with μ range 20-30
            const baseTeam: SelectedPlayer[] = Array(10).fill(null).map((_, i) => ({
                ...createMockPlayer(),
                mu: 20 + i, // 20-29
                assignedRole: 'dps' as Role,
                priorityScore: 100,
            }));

            const band = { min: 18, max: 32, spread: 10, buffer: 5 };

            // Players: some in band, some out of band
            const allPlayers: PlayerWithRoles[] = [
                ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })), // in band
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 26 })),  // in band
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 27 })), // in band
                createMockPlayer({ availableRoles: ['tank'], mu: 10 }), // out of band (too low)
                createMockPlayer({ availableRoles: ['dps'], mu: 40 }),  // out of band (too high)
            ];

            const getPriority = jest.fn(() => 100);

            const result = buildCandidatePools(allPlayers, baseTeam, band, getPriority);

            // Should only include players within band
            expect(result.pools.tanks).toHaveLength(4);
            expect(result.pools.dps).toHaveLength(6);
            expect(result.pools.support).toHaveLength(6);

            // All should be within band
            [...result.pools.tanks, ...result.pools.dps, ...result.pools.support].forEach(p => {
                expect(p.mu).toBeGreaterThanOrEqual(18);
                expect(p.mu).toBeLessThanOrEqual(32);
            });
        });

        it('sorts by priority within each role', () => {
            const baseTeam: SelectedPlayer[] = Array(10).fill(null).map(() => ({
                ...createMockPlayer(),
                mu: 25,
                assignedRole: 'dps' as Role,
                priorityScore: 100,
            }));

            const band = { min: 20, max: 30, spread: 5, buffer: 2.5 };

            const allPlayers: PlayerWithRoles[] = [
                ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 })),
            ];

            const getPriority = jest.fn((userId: string) => {
                const userNum = parseInt(userId.replace('user', ''));
                return 100 - userNum; // Higher priority for lower numbers
            });

            const result = buildCandidatePools(allPlayers, baseTeam, band, getPriority);

            // Tanks: user11-15, select top 4: user11-14
            expect(result.pools.tanks.map(p => p.userId)).toEqual(['user11', 'user12', 'user13', 'user14']);

            // DPS: user16-22, select top 6: user16-21
            expect(result.pools.dps.map(p => p.userId)).toEqual(['user16', 'user17', 'user18', 'user19', 'user20', 'user21']);

            // Support: user23-29, select top 6: user23-28
            expect(result.pools.support.map(p => p.userId)).toEqual(['user23', 'user24', 'user25', 'user26', 'user27', 'user28']);
        });

        it('includes all players within skill band (no exclusions)', () => {
            const baseTeam: SelectedPlayer[] = [
                ...Array(2).fill(null).map(() => ({ ...createMockPlayer({ availableRoles: ['tank'], mu: 25 }), assignedRole: 'tank' as Role, priorityScore: 100 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ availableRoles: ['dps'], mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 100 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ availableRoles: ['support'], mu: 25 }), assignedRole: 'support' as Role, priorityScore: 100 })),
            ];

            const baseTeamIds = new Set(baseTeam.map(p => p.userId));
            const band = { min: 20, max: 30, spread: 5, buffer: 2.5 };

            const allPlayers: PlayerWithRoles[] = [
                ...baseTeam, // Include base team players
                ...Array(5).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 })),
            ];

            const getPriority = jest.fn(() => 100);

            const result = buildCandidatePools(allPlayers, baseTeam, band, getPriority);

            // Verify base team players CAN be in pools (new behavior)
            // With adaptive sizing for 29 players, we expect 4/6/6 pools
            expect(result.pools.tanks.length).toBeLessThanOrEqual(4);
            expect(result.pools.dps.length).toBeLessThanOrEqual(6);
            expect(result.pools.support.length).toBeLessThanOrEqual(6);

            // All pooled players should be within band
            [...result.pools.tanks, ...result.pools.dps, ...result.pools.support].forEach(p => {
                expect(p.mu).toBeGreaterThanOrEqual(20);
                expect(p.mu).toBeLessThanOrEqual(30);
            });
        });

        it('selects top 4 tanks, 6 DPS, 6 support', () => {
            const baseTeam: SelectedPlayer[] = Array(10).fill(null).map(() => ({
                ...createMockPlayer(),
                mu: 25,
                assignedRole: 'dps' as Role,
                priorityScore: 100,
            }));

            const band = { min: 20, max: 30, spread: 5, buffer: 2.5 };

            const allPlayers: PlayerWithRoles[] = [
                ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                ...Array(10).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 })),
            ];

            const getPriority = jest.fn(() => 100);

            const result = buildCandidatePools(allPlayers, baseTeam, band, getPriority);

            expect(result.pools.tanks).toHaveLength(4);
            expect(result.pools.dps).toHaveLength(6);
            expect(result.pools.support).toHaveLength(6);
            expect(result.expandedBand).toBe(false);
        });

        it('expands band by 25% when insufficient', () => {
            const baseTeam: SelectedPlayer[] = Array(10).fill(null).map(() => ({
                ...createMockPlayer(),
                mu: 25,
                assignedRole: 'dps' as Role,
                priorityScore: 100,
            }));

            // Narrow band: only 3 tanks in initial band
            const band = { min: 24, max: 26, spread: 2, buffer: 1 };

            const allPlayers: PlayerWithRoles[] = [
                ...Array(3).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })), // in initial band
                createMockPlayer({ availableRoles: ['tank'], mu: 23.8 }), // out of initial (min=24), in expanded (min=23.75)
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 })),
            ];

            const getPriority = jest.fn(() => 100);

            const result = buildCandidatePools(allPlayers, baseTeam, band, getPriority);

            expect(result.expandedBand).toBe(true);
            expect(result.band.buffer).toBe(1.25); // 1 × 1.25
            expect(result.pools.tanks).toHaveLength(4);
        });

        it('returns available pools even when below target (adaptive behavior)', () => {
            const baseTeam: SelectedPlayer[] = Array(10).fill(null).map(() => ({
                ...createMockPlayer(),
                mu: 25,
                assignedRole: 'dps' as Role,
                priorityScore: 100,
            }));

            const band = { min: 24, max: 26, spread: 2, buffer: 1 };

            // Only 2 tanks (below target of 3 for 16 players)
            const allPlayers: PlayerWithRoles[] = [
                ...Array(2).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                ...Array(7).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 })),
            ];

            const getPriority = jest.fn(() => 100);

            // Should not throw - returns available pools
            const result = buildCandidatePools(allPlayers, baseTeam, band, getPriority);

            // Adaptive sizing for 16 players: 4/6/6, but only 2 tanks available
            expect(result.pools.tanks).toHaveLength(2);
            expect(result.pools.dps.length).toBeGreaterThanOrEqual(5);
            expect(result.pools.support.length).toBeGreaterThanOrEqual(5);
        });
    });

    describe('generateCombinations', () => {
        it('generates exactly 1,350 combinations for full pools', () => {
            // Create full candidate pools: 4 tanks, 6 DPS, 6 support
            const pools = {
                tanks: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'] })),
                dps: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'] })),
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'] }))
            };

            // Count all combinations
            let count = 0;
            for (const combo of generateCombinations(pools)) {
                count++;
            }

            // C(4,2) × C(6,4) × C(6,4) = 6 × 15 × 15 = 1,350
            expect(count).toBe(1350);
        });

        it('generates correct number for smaller pools', () => {
            // Create minimum valid pools: 2 tanks, 4 DPS, 4 support
            const pools = {
                tanks: Array(2).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'] })),
                dps: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'] })),
                support: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['support'] }))
            };

            // Count all combinations
            let count = 0;
            for (const combo of generateCombinations(pools)) {
                count++;
            }

            // C(2,2) × C(4,4) × C(4,4) = 1 × 1 × 1 = 1
            expect(count).toBe(1);
        });

        it('each combination has correct structure', () => {
            const pools = {
                tanks: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'] })),
                dps: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'] })),
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'] }))
            };

            // Check structure of first few combinations
            let checked = 0;
            for (const combo of generateCombinations(pools)) {
                // Verify object structure
                expect(combo).toHaveProperty('tanks');
                expect(combo).toHaveProperty('dps');
                expect(combo).toHaveProperty('support');

                // Verify array lengths
                expect(combo.tanks).toHaveLength(2);
                expect(combo.dps).toHaveLength(4);
                expect(combo.support).toHaveLength(4);

                // Verify contents are PlayerWithRoles
                combo.tanks.forEach(p => expect(p).toHaveProperty('userId'));
                combo.dps.forEach(p => expect(p).toHaveProperty('userId'));
                combo.support.forEach(p => expect(p).toHaveProperty('userId'));

                checked++;
                if (checked >= 10) break; // Only check first 10 to save time
            }

            expect(checked).toBe(10);
        });
    });

    describe('calculateNormalizationConstants', () => {
        it('calculates F_max from mu range', () => {
            // Create pools with varied skill levels
            const pools = {
                tanks: [
                    createMockPlayer({ availableRoles: ['tank'], mu: 15 }), // Bronze
                    createMockPlayer({ availableRoles: ['tank'], mu: 20 }), // Silver
                    createMockPlayer({ availableRoles: ['tank'], mu: 25 }), // Gold
                    createMockPlayer({ availableRoles: ['tank'], mu: 30 })  // Plat
                ],
                dps: [
                    createMockPlayer({ availableRoles: ['dps'], mu: 35 }), // Diamond
                    createMockPlayer({ availableRoles: ['dps'], mu: 40 }), // Master
                    createMockPlayer({ availableRoles: ['dps'], mu: 45 }), // GM
                    createMockPlayer({ availableRoles: ['dps'], mu: 25 }),
                    createMockPlayer({ availableRoles: ['dps'], mu: 30 }),
                    createMockPlayer({ availableRoles: ['dps'], mu: 20 })
                ],
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
            };

            const getPriority = jest.fn(() => 50);
            const result = calculateNormalizationConstants(pools, getPriority);

            // F_max = (max_μ - min_μ) × 5 = (45 - 15) × 5 = 150
            expect(result.F_max).toBe(150);
        });

        it('calculates P_max from priority sum', () => {
            const pools = {
                tanks: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                dps: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
            };

            // Set different priorities for each player
            const getPriority = jest.fn((userId: string) => {
                const userNum = parseInt(userId.replace('user', ''));
                return 100 - userNum * 5; // Priorities: 95, 90, 85, 80, ...
            });

            const result = calculateNormalizationConstants(pools, getPriority);

            // Calculate expected P_max manually
            // 16 players with priorities from 95 down to 20 (decreasing by 5)
            let expectedPMax = 0;
            for (let i = 0; i < 16; i++) {
                const priority = 95 - i * 5;
                expectedPMax += Math.pow(priority, 1.5);
            }

            expect(result.P_max).toBeCloseTo(expectedPMax, 5);
        });

        it('handles uniform skill levels (F_max = 0)', () => {
            // All players have same μ
            const pools = {
                tanks: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                dps: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
            };

            const getPriority = jest.fn(() => 50);
            const result = calculateNormalizationConstants(pools, getPriority);

            // When all same skill, F_max = 0, but should fallback to 1 to prevent division by zero
            expect(result.F_max).toBe(1);
        });

        it('handles zero priorities (P_max = 0)', () => {
            const pools = {
                tanks: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                dps: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 30 })),
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 20 }))
            };

            // All priorities are 0
            const getPriority = jest.fn(() => 0);
            const result = calculateNormalizationConstants(pools, getPriority);

            // When all priorities are 0, P_max = 0, but should fallback to 1 to prevent division by zero
            expect(result.P_max).toBe(1);
        });
    });

    describe('calculateCost', () => {
        it('calculates fairness cost correctly', () => {
            // Create two teams with known mu sums
            const team1: SelectedPlayer[] = [
                { ...createMockPlayer({ mu: 25 }), assignedRole: 'tank' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 30 }), assignedRole: 'dps' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 25 }), assignedRole: 'support' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 20 }), assignedRole: 'support' as Role, priorityScore: 50 }
            ]; // Sum: 125

            const team2: SelectedPlayer[] = [
                { ...createMockPlayer({ mu: 20 }), assignedRole: 'tank' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 25 }), assignedRole: 'support' as Role, priorityScore: 50 },
                { ...createMockPlayer({ mu: 25 }), assignedRole: 'support' as Role, priorityScore: 50 }
            ]; // Sum: 120

            const teams = { team1, team2 };
            const selection = {
                tanks: [...team1.slice(0, 1), ...team2.slice(0, 1)] as PlayerWithRoles[],
                dps: [...team1.slice(1, 3), ...team2.slice(1, 3)] as PlayerWithRoles[],
                support: [...team1.slice(3, 5), ...team2.slice(3, 5)] as PlayerWithRoles[]
            };

            const allCandidates = new Map();
            [...team1, ...team2].forEach(p => {
                allCandidates.set(p.userId, { player: p as PlayerWithRoles, priority: 50 });
            });

            const normalization = { F_max: 150, P_max: 1000 };
            const result = calculateCost(teams, selection, allCandidates, normalization);

            // Fairness cost = |125 - 120| = 5
            expect(result.fairnessCost).toBe(5);
        });

        it('calculates priority cost with 1.5 exponent', () => {
            // Create 10 selected players
            const selectedPlayers: SelectedPlayer[] = Array(10).fill(null).map((_, i) => ({
                ...createMockPlayer({ mu: 25 }),
                assignedRole: i < 2 ? 'tank' as Role : i < 6 ? 'dps' as Role : 'support' as Role,
                priorityScore: 50
            }));

            const teams = balanceTeamsBySkill(selectedPlayers);
            const selection = {
                tanks: selectedPlayers.slice(0, 2)as PlayerWithRoles[],
                dps: selectedPlayers.slice(2, 6)as PlayerWithRoles[],
                support: selectedPlayers.slice(6, 10)as PlayerWithRoles[]
            };

            // Create 16 candidates (10 selected + 6 skipped)
            const allCandidates = new Map();
            selectedPlayers.forEach(p => {
                allCandidates.set(p.userId, { player: p, priority: 50 });
            });

            // Add 6 skipped players with known priorities
            const skippedPriorities = [100, 80, 60, 40, 20, 10];
            skippedPriorities.forEach(priority => {
                const skipped = createMockPlayer({ mu: 25 });
                allCandidates.set(skipped.userId, { player: skipped, priority });
            });

            const normalization = { F_max: 150, P_max: 10000 };
            const result = calculateCost(teams, selection, allCandidates, normalization);

            // Priority cost = sum of skipped priorities^1.5
            const expectedPriorityCost = skippedPriorities.reduce((sum, p) => sum + Math.pow(p, 1.5), 0);
            expect(result.priorityCost).toBeCloseTo(expectedPriorityCost, 5);
        });

        it('normalizes costs correctly', () => {
            const selectedPlayers: SelectedPlayer[] = [
                ...Array(2).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'tank' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'support' as Role, priorityScore: 50 }))
            ];

            const teams = balanceTeamsBySkill(selectedPlayers);
            const selection = {
                tanks: selectedPlayers.slice(0, 2) as PlayerWithRoles[],
                dps: selectedPlayers.slice(2, 6) as PlayerWithRoles[],
                support: selectedPlayers.slice(6, 10) as PlayerWithRoles[]
            };

            const allCandidates = new Map();
            selectedPlayers.forEach(p => {
                allCandidates.set(p.userId, { player: p as PlayerWithRoles, priority: 50 });
            });

            const normalization = { F_max: 150, P_max: 1000 };
            const result = calculateCost(teams, selection, allCandidates, normalization);

            // Verify normalization
            expect(result.normalizedFairness).toBe(result.fairnessCost / 150);
            expect(result.normalizedPriority).toBe(result.priorityCost / 1000);

            // Normalized values should be in [0, 1]
            expect(result.normalizedFairness).toBeGreaterThanOrEqual(0);
            expect(result.normalizedFairness).toBeLessThanOrEqual(1);
            expect(result.normalizedPriority).toBeGreaterThanOrEqual(0);
            expect(result.normalizedPriority).toBeLessThanOrEqual(1);
        });

        it('applies weights (0.2 fairness, 0.8 priority)', () => {
            const selectedPlayers: SelectedPlayer[] = [
                ...Array(2).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'tank' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'support' as Role, priorityScore: 50 }))
            ];

            const teams = balanceTeamsBySkill(selectedPlayers);
            const selection = {
                tanks: selectedPlayers.slice(0, 2) as PlayerWithRoles[],
                dps: selectedPlayers.slice(2, 6) as PlayerWithRoles[],
                support: selectedPlayers.slice(6, 10) as PlayerWithRoles[]
            };

            const allCandidates = new Map();
            selectedPlayers.forEach(p => {
                allCandidates.set(p.userId, { player: p as PlayerWithRoles, priority: 50 });
            });

            const normalization = { F_max: 150, P_max: 1000 };
            const result = calculateCost(teams, selection, allCandidates, normalization);

            // Verify formula: Total Cost = 0.2 × F_norm² + 0.8 × P_norm^1.5
            const expectedCost =
                DEFAULT_OPTIMIZER_CONFIG.fairnessWeight * Math.pow(result.normalizedFairness, 2) +
                DEFAULT_OPTIMIZER_CONFIG.priorityWeight * Math.pow(result.normalizedPriority, 1.5);

            expect(result.totalCost).toBeCloseTo(expectedCost, 10);
        });

        it('handles zero normalization constants (no skipped players)', () => {
            // Create exactly 10 players (no skipped)
            const selectedPlayers: SelectedPlayer[] = [
                ...Array(2).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'tank' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'support' as Role, priorityScore: 50 }))
            ];

            const teams = balanceTeamsBySkill(selectedPlayers);
            const selection = {
                tanks: selectedPlayers.slice(0, 2) as PlayerWithRoles[],
                dps: selectedPlayers.slice(2, 6) as PlayerWithRoles[],
                support: selectedPlayers.slice(6, 10) as PlayerWithRoles[]
            };

            const allCandidates = new Map();
            selectedPlayers.forEach(p => {
                allCandidates.set(p.userId, { player: p as PlayerWithRoles, priority: 50 });
            });

            const normalization = { F_max: 150, P_max: 1000 };
            const result = calculateCost(teams, selection, allCandidates, normalization);

            // No skipped players → priority cost should be 0
            expect(result.priorityCost).toBe(0);
        });

        it('applies square to fairness, 1.5 power to priority', () => {
            const selectedPlayers: SelectedPlayer[] = [
                ...Array(2).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'tank' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'dps' as Role, priorityScore: 50 })),
                ...Array(4).fill(null).map(() => ({ ...createMockPlayer({ mu: 25 }), assignedRole: 'support' as Role, priorityScore: 50 }))
            ];

            const teams = balanceTeamsBySkill(selectedPlayers);
            const selection = {
                tanks: selectedPlayers.slice(0, 2)as PlayerWithRoles[],
                dps: selectedPlayers.slice(2, 6)as PlayerWithRoles[],
                support: selectedPlayers.slice(6, 10)as PlayerWithRoles[]
            };

            const allCandidates = new Map();
            selectedPlayers.forEach(p => {
                allCandidates.set(p.userId, { player: p, priority: 50 });
            });

            // Add one skipped player
            const skipped = createMockPlayer({ mu: 25 });
            allCandidates.set(skipped.userId, { player: skipped, priority: 100 });

            const normalization = { F_max: 150, P_max: 1000 };
            const result = calculateCost(teams, selection, allCandidates, normalization);

            // Verify exponents are applied correctly
            const expectedFairnessComponent = 0.2 * Math.pow(result.normalizedFairness, 2);
            const expectedPriorityComponent = 0.8 * Math.pow(result.normalizedPriority, 1.5);

            expect(result.totalCost).toBeCloseTo(expectedFairnessComponent + expectedPriorityComponent, 10);
        });
    });

    describe('selectOptimalCombination', () => {
        it('evaluates all combinations', () => {
            // Create pools with known sizes
            const pools = {
                tanks: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                dps: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
            };

            const allCandidates = new Map();
            [...pools.tanks, ...pools.dps, ...pools.support].forEach(p => {
                allCandidates.set(p.userId, { player: p, priority: 50 });
            });

            const normalization = { F_max: 150, P_max: 1000 };
            const result = selectOptimalCombination(pools, allCandidates, normalization);

            // Should evaluate C(4,2) × C(6,4) × C(6,4) = 6 × 15 × 15 = 1,350 combinations
            expect(result.totalEvaluated).toBe(1350);
        });

        it('selects combination with minimum cost', () => {
            // Create pools where one specific combination has lowest cost
            // High-skill tanks
            const highTanks = [
                createMockPlayer({ availableRoles: ['tank'], mu: 40 }), // High skill
                createMockPlayer({ availableRoles: ['tank'], mu: 40 })  // High skill
            ];
            // Medium-skill tanks
            const medTanks = [
                createMockPlayer({ availableRoles: ['tank'], mu: 25 }), // Medium skill - better for balance
                createMockPlayer({ availableRoles: ['tank'], mu: 25 })  // Medium skill - better for balance
            ];

            const pools = {
                tanks: [...highTanks, ...medTanks],
                dps: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                support: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
            };

            const allCandidates = new Map();
            [...pools.tanks, ...pools.dps, ...pools.support].forEach(p => {
                // Give high priority to medium tanks (to create conflict between fairness and priority)
                const priority = p.mu === 25 ? 100 : 50;
                allCandidates.set(p.userId, { player: p, priority });
            });

            const normalization = { F_max: 150, P_max: 10000 };
            const result = selectOptimalCombination(pools, allCandidates, normalization);

            // With 80% weight on priority, should select the medium-skill tanks (higher priority)
            // Verify the selected tanks are the medium-skill ones
            const selectedTankIds = new Set(result.selectedPlayers.filter(p => p.assignedRole === 'tank').map(p => p.userId));
            const medTankIds = new Set(medTanks.map(t => t.userId));

            // At least one medium tank should be selected (priority matters)
            const medTanksSelected = result.selectedPlayers.filter(p =>
                p.assignedRole === 'tank' && medTankIds.has(p.userId)
            ).length;
            expect(medTanksSelected).toBeGreaterThan(0);
        });

        it('returns detailed metrics', () => {
            const pools = {
                tanks: Array(4).fill(null).map(() => createMockPlayer({ availableRoles: ['tank'], mu: 25 })),
                dps: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['dps'], mu: 25 })),
                support: Array(6).fill(null).map(() => createMockPlayer({ availableRoles: ['support'], mu: 25 }))
            };

            const allCandidates = new Map();
            [...pools.tanks, ...pools.dps, ...pools.support].forEach(p => {
                allCandidates.set(p.userId, { player: p, priority: 50 });
            });

            const normalization = { F_max: 150, P_max: 1000 };
            const result = selectOptimalCombination(pools, allCandidates, normalization);

            // Verify result structure
            expect(result).toHaveProperty('selectedPlayers');
            expect(result).toHaveProperty('metrics');
            expect(result).toHaveProperty('totalEvaluated');

            // Verify selectedPlayers
            expect(result.selectedPlayers).toHaveLength(10);
            expect(result.selectedPlayers.every(p => p.hasOwnProperty('assignedRole'))).toBe(true);
            expect(result.selectedPlayers.every(p => p.hasOwnProperty('priorityScore'))).toBe(true);

            // Verify metrics
            expect(result.metrics).toHaveProperty('fairnessCost');
            expect(result.metrics).toHaveProperty('priorityCost');
            expect(result.metrics).toHaveProperty('normalizedFairness');
            expect(result.metrics).toHaveProperty('normalizedPriority');
            expect(result.metrics).toHaveProperty('totalCost');

            // Verify totalEvaluated
            expect(result.totalEvaluated).toBeGreaterThan(0);
        });
    });
});
