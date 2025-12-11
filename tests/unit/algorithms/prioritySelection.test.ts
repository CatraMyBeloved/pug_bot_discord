import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import {
    InsufficientPlayersError,
    InsufficientRoleCompositionError,
    selectPlayersByPriority,
} from '../../../src/utils/algorithms/prioritySelection';
import {createMockPlayer, createMockRoster, createStandardRoster, resetUserIdCounter,} from '../../fixtures/players';

describe('selectPlayersByPriority', () => {
    beforeEach(() => {
        resetUserIdCounter();
    });

    afterEach(() => {
        resetUserIdCounter();
    });

    describe('Happy Path', () => {
        it('selects 10 players from pool with standard composition', () => {
            const players = createMockRoster(2, 4, 4);
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            expect(result).toHaveLength(10);
            expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
            expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
            expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);
        });

        it('selects 10 players from larger pool', () => {
            const players = createMockRoster(3, 6, 6); // 15 players
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            expect(result).toHaveLength(10);
            expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
            expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
            expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);
        });

        it('assigns roles correctly to multi-role players', () => {
            const players = [
                createMockPlayer({availableRoles: ['tank', 'dps']}),
                createMockPlayer({availableRoles: ['tank', 'dps']}),
                ...createMockRoster(0, 4, 4), // Only DPS and support
            ];
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
            expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
            expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);
        });

        it('assigns each selected player exactly one role', () => {
            const players = createStandardRoster();
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            result.forEach(player => {
                expect(player.assignedRole).toBeDefined();
                expect(['tank', 'dps', 'support']).toContain(player.assignedRole);
            });
        });

        it('does not select the same player twice', () => {
            const players = [
                createMockPlayer({availableRoles: ['tank', 'dps', 'support']}),
                ...createMockRoster(2, 4, 4),
            ];
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            const userIds = result.map(p => p.userId);
            const uniqueUserIds = new Set(userIds);
            expect(uniqueUserIds.size).toBe(userIds.length);
        });

        it('includes priority scores in result', () => {
            const players = createStandardRoster();
            const getPriority = jest.fn(() => 5);

            const result = selectPlayersByPriority(players, getPriority);

            result.forEach(player => {
                expect(player.priorityScore).toBeDefined();
                expect(typeof player.priorityScore).toBe('number');
            });
        });
    });

    describe('Error Handling', () => {
        it('throws InsufficientPlayersError when fewer than 10 players', () => {
            const players = createMockRoster(1, 2, 3); // Only 6 players
            const getPriority = jest.fn(() => 1);

            expect(() => selectPlayersByPriority(players, getPriority))
                .toThrow(InsufficientPlayersError);
        });

        it('throws InsufficientPlayersError with correct counts', () => {
            const players = createMockRoster(1, 2, 2); // 5 players
            const getPriority = jest.fn(() => 1);

            try {
                selectPlayersByPriority(players, getPriority);
                fail('Expected InsufficientPlayersError to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(InsufficientPlayersError);
                const err = error as InsufficientPlayersError;
                expect(err.required).toBe(10);
                expect(err.found).toBe(5);
            }
        });

        it('throws InsufficientRoleCompositionError when not enough tanks', () => {
            const players = createMockRoster(1, 5, 4); // Only 1 tank
            const getPriority = jest.fn(() => 1);

            expect(() => selectPlayersByPriority(players, getPriority))
                .toThrow(InsufficientRoleCompositionError);
        });

        it('throws InsufficientRoleCompositionError when not enough dps', () => {
            const players = createMockRoster(2, 3, 5); // Only 3 DPS
            const getPriority = jest.fn(() => 1);

            expect(() => selectPlayersByPriority(players, getPriority))
                .toThrow(InsufficientRoleCompositionError);
        });

        it('throws InsufficientRoleCompositionError when not enough supports', () => {
            const players = createMockRoster(2, 6, 2); // Only 2 support
            const getPriority = jest.fn(() => 1);

            expect(() => selectPlayersByPriority(players, getPriority))
                .toThrow(InsufficientRoleCompositionError);
        });

        it('throws InsufficientRoleCompositionError with correct role counts', () => {
            const players = createMockRoster(1, 5, 4); // Insufficient tanks
            const getPriority = jest.fn(() => 1);

            try {
                selectPlayersByPriority(players, getPriority);
                fail('Expected InsufficientRoleCompositionError to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(InsufficientRoleCompositionError);
                const err = error as InsufficientRoleCompositionError;
                expect(err.required.tank).toBe(2);
                expect(err.found.tank).toBe(1);
            }
        });

        it('throws InsufficientRoleCompositionError when flex players cause shortage', () => {
            // Edge case: flex players get selected for one role, causing shortage in another
            // 2 flex players (tank/support), 0 tank-only, 6 dps-only, 2 support-only (10 total)
            // Initial validation: tank pool=2, dps pool=8, support pool=4 (all pass)
            // After selecting 2 tanks (both flex), only 2 support-only remain (need 4)
            const players = [
                createMockPlayer({availableRoles: ['tank', 'support']}),
                createMockPlayer({availableRoles: ['tank', 'support']}),
                ...createMockRoster(0, 6, 2), // 0 tanks, 6 dps, 2 support
            ];
            const getPriority = jest.fn(() => 1);

            try {
                selectPlayersByPriority(players, getPriority);
                fail('Expected InsufficientRoleCompositionError to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(InsufficientRoleCompositionError);
                const err = error as InsufficientRoleCompositionError;
                expect(err.required.support).toBe(4);
                expect(err.found.support).toBe(2);
            }
        });
    });

    describe('Priority System', () => {
        it('selects players with higher priority scores', () => {
            const players = createMockRoster(3, 6, 6);
            const getPriority = jest.fn((userId: string) => {
                const userNum = parseInt(userId.replace('user', ''));
                if (userNum <= 2) return 1000 - (userNum - 1) * 100;
                if (userNum === 3) return 1;
                if (userNum >= 4 && userNum <= 7) return 1000;
                if (userNum >= 8 && userNum <= 9) return 1;
                if (userNum >= 10 && userNum <= 13) return 1000;
                return 1;
            });

            const result = selectPlayersByPriority(players, getPriority);

            const selectedUserIds = result.map(p => p.userId);
            expect(result).toHaveLength(10);

            expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
            expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
            expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);

            expect(selectedUserIds).toContain('user1');
            expect(selectedUserIds).toContain('user2');
            expect(selectedUserIds).not.toContain('user3'); // Low priority tank

            for (let i = 4; i <= 7; i++) {
                expect(selectedUserIds).toContain(`user${i}`);
            }
            expect(selectedUserIds).not.toContain('user8');
            expect(selectedUserIds).not.toContain('user9');

            const selectedSupports = result.filter(p => p.assignedRole === 'support');
            selectedSupports.forEach(player => {
                expect(player.priorityScore).toBe(1000);
                const userNum = parseInt(player.userId.replace('user', ''));
                expect(userNum).toBeGreaterThanOrEqual(10);
                expect(userNum).toBeLessThanOrEqual(13);
            });
        });

        it('calls getPriorityScore with userId and role', () => {
            const players = createStandardRoster();
            const getPriority = jest.fn((userId: string, role: string) => 1);

            selectPlayersByPriority(players, getPriority);

            expect(getPriority).toHaveBeenCalled();
            expect(getPriority.mock.calls.length).toBeGreaterThan(0);
            getPriority.mock.calls.forEach(call => {
                expect(typeof call[0]).toBe('string'); // userId
                expect(['tank', 'dps', 'support']).toContain(call[1]); // role
            });
        });

        it('respects priority scores within each role pool', () => {
            const players = [
                createMockPlayer({userId: 'tank1', availableRoles: ['tank']}),
                createMockPlayer({userId: 'tank2', availableRoles: ['tank']}),
                createMockPlayer({userId: 'tank3', availableRoles: ['tank']}),
                ...createMockRoster(0, 4, 4),
            ];
            const getPriority = jest.fn((userId: string) => {
                if (userId === 'tank1') return 10;
                if (userId === 'tank2') return 5;
                if (userId === 'tank3') return 1;
                return 1;
            });

            const result = selectPlayersByPriority(players, getPriority);

            const selectedTanks = result
                .filter(p => p.assignedRole === 'tank')
                .map(p => p.userId);
            expect(selectedTanks).toHaveLength(2);
            expect(selectedTanks).toContain('tank1');
            expect(selectedTanks).toContain('tank2');
            expect(selectedTanks).not.toContain('tank3');
        });

        it('handles Infinity priority scores', () => {
            const players = createMockRoster(3, 5, 5);
            const getPriority = jest.fn((userId: string) => {
                const userNum = parseInt(userId.replace('user', ''));
                return userNum <= 2 ? Infinity : 1;
            });

            const result = selectPlayersByPriority(players, getPriority);

            const selectedUserIds = result.map(p => p.userId);
            expect(selectedUserIds).toContain('user1');
            expect(selectedUserIds).toContain('user2');
        });
    });

    describe('Role Selection Order', () => {
        it('selects from scarce roles first (tanks → supports → dps)', () => {
            const players = createMockRoster(2, 5, 4);
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            expect(result).toHaveLength(10);
            expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
            expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);
            expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
        });
    });

    describe('Edge Cases', () => {
        it('handles exactly 10 players with exact composition', () => {
            const players = createStandardRoster();
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            expect(result).toHaveLength(10);
        });

        it('handles players with all three roles available', () => {
            const players = [
                createMockPlayer({availableRoles: ['tank', 'dps', 'support']}),
                createMockPlayer({availableRoles: ['tank', 'dps', 'support']}),
                ...createMockRoster(1, 4, 4),
            ];
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            expect(result).toHaveLength(10);
            expect(result.filter(p => p.assignedRole === 'tank')).toHaveLength(2);
            expect(result.filter(p => p.assignedRole === 'dps')).toHaveLength(4);
            expect(result.filter(p => p.assignedRole === 'support')).toHaveLength(4);

            // Verify no player is selected twice
            const userIds = result.map(p => p.userId);
            const uniqueUserIds = new Set(userIds);
            expect(uniqueUserIds.size).toBe(userIds.length);
        });

        it('handles different rank players', () => {
            const players = [
                ...createMockRoster(1, 2, 2, 'grandmaster'),
                ...createMockRoster(1, 2, 2, 'bronze'),
            ];
            const getPriority = jest.fn(() => 1);

            const result = selectPlayersByPriority(players, getPriority);

            expect(result).toHaveLength(10);
        });
    });
});
