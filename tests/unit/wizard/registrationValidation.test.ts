import {describe, expect, it} from '@jest/globals';
import {
    validateBattlenetId,
    validateRoles,
    validateRank,
    validateRegistrationComplete,
    isRegistrationComplete,
} from '../../../src/wizard/registrationValidation';
import {RegistrationData} from '../../../src/wizard/RegistrationState';

describe('Registration Validation', () => {
    describe('validateBattlenetId', () => {
        it('validates correct Battle.net ID format', () => {
            const result = validateBattlenetId('Player#1234');

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('validates Battle.net ID with more than 4 digits', () => {
            const result = validateBattlenetId('Player#123456');

            expect(result.valid).toBe(true);
        });

        it('rejects empty Battle.net ID', () => {
            const result = validateBattlenetId('');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('cannot be empty');
        });

        it('rejects Battle.net ID without # character', () => {
            const result = validateBattlenetId('Player1234');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid Battle.net ID format');
            expect(result.error).toContain('Name#1234');
        });

        it('rejects Battle.net ID with multiple # characters', () => {
            const result = validateBattlenetId('Player#12#34');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Use only one # character');
        });

        it('rejects Battle.net ID with empty name part', () => {
            const result = validateBattlenetId('#1234');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('must have a name before the # character');
        });

        it('rejects Battle.net ID with less than 4 digits', () => {
            const result = validateBattlenetId('Player#123');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('at least 4 digits after the # character');
        });

        it('rejects Battle.net ID with non-numeric digits', () => {
            const result = validateBattlenetId('Player#abcd');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('at least 4 digits after the # character');
        });

        it('trims whitespace and validates correctly', () => {
            const result = validateBattlenetId('  Player#1234  ');

            expect(result.valid).toBe(true);
        });

        it('validates complex usernames', () => {
            const result1 = validateBattlenetId('Cool-Player_123#5678');
            const result2 = validateBattlenetId('Player.Name#1234');

            expect(result1.valid).toBe(true);
            expect(result2.valid).toBe(true);
        });
    });

    describe('validateRoles', () => {
        it('validates when at least one role is selected', () => {
            const result = validateRoles(['tank']);

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('validates when multiple roles are selected', () => {
            const result = validateRoles(['tank', 'dps', 'support']);

            expect(result.valid).toBe(true);
        });

        it('rejects when no roles are selected', () => {
            const result = validateRoles([]);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('select at least one role');
        });
    });

    describe('validateRank', () => {
        it('validates bronze rank', () => {
            const result = validateRank('bronze');

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('validates all valid ranks', () => {
            const ranks = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster'];

            ranks.forEach(rank => {
                const result = validateRank(rank as any);
                expect(result.valid).toBe(true);
            });
        });

        it('rejects null rank', () => {
            const result = validateRank(null);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('select a rank');
        });

        it('rejects invalid rank', () => {
            const result = validateRank('invalid' as any);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid rank');
        });
    });

    describe('validateRegistrationComplete', () => {
        it('validates complete registration data', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank', 'support'],
                selectedRank: 'diamond',
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('rejects when battlenetId is null', () => {
            const data: RegistrationData = {
                battlenetId: null,
                selectedRoles: ['tank'],
                selectedRank: 'gold',
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Battle.net ID is required');
        });

        it('rejects when battlenetId has invalid format', () => {
            const data: RegistrationData = {
                battlenetId: 'InvalidFormat',
                selectedRoles: ['tank'],
                selectedRank: 'gold',
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid Battle.net ID format');
        });

        it('rejects when selectedRoles is empty', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: [],
                selectedRank: 'gold',
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('select at least one role');
        });

        it('rejects when selectedRank is null', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['dps'],
                selectedRank: null,
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('select a rank');
        });

        it('rejects when multiple fields are invalid', () => {
            const data: RegistrationData = {
                battlenetId: null,
                selectedRoles: [],
                selectedRank: null,
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(false);
            // Should return the first error encountered
            expect(result.error).toBeDefined();
        });

        it('validates with single role', () => {
            const data: RegistrationData = {
                battlenetId: 'Gamer#9999',
                selectedRoles: ['support'],
                selectedRank: 'bronze',
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(true);
        });

        it('validates with all roles', () => {
            const data: RegistrationData = {
                battlenetId: 'FlexPlayer#1111',
                selectedRoles: ['tank', 'dps', 'support'],
                selectedRank: 'grandmaster',
            };

            const result = validateRegistrationComplete(data);

            expect(result.valid).toBe(true);
        });
    });

    describe('isRegistrationComplete', () => {
        it('returns true for complete registration', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['tank'],
                selectedRank: 'gold',
            };

            expect(isRegistrationComplete(data)).toBe(true);
        });

        it('returns false for incomplete registration', () => {
            const data: RegistrationData = {
                battlenetId: null,
                selectedRoles: ['tank'],
                selectedRank: 'gold',
            };

            expect(isRegistrationComplete(data)).toBe(false);
        });

        it('returns false when roles are missing', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: [],
                selectedRank: 'gold',
            };

            expect(isRegistrationComplete(data)).toBe(false);
        });

        it('returns false when rank is missing', () => {
            const data: RegistrationData = {
                battlenetId: 'Player#1234',
                selectedRoles: ['dps'],
                selectedRank: null,
            };

            expect(isRegistrationComplete(data)).toBe(false);
        });
    });
});
