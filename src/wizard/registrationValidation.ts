import { Role, Rank } from '../types/matchmaking';
import { RegistrationData } from './RegistrationState';

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates Battle.net ID format
 * Must contain '#' character and follow pattern: Name#1234
 */
export function validateBattlenetId(battlenetId: string): ValidationResult {
    if (!battlenetId || battlenetId.trim().length === 0) {
        return {
            valid: false,
            error: 'Battle.net ID cannot be empty.',
        };
    }

    const trimmed = battlenetId.trim();

    // Must contain # character
    if (!trimmed.includes('#')) {
        return {
            valid: false,
            error: 'Invalid Battle.net ID format. Please use format: Name#1234\n\nExamples:\n- Player#1234\n- CoolGamer#5678',
        };
    }

    // Split by # and validate parts
    const parts = trimmed.split('#');
    if (parts.length !== 2) {
        return {
            valid: false,
            error: 'Invalid Battle.net ID format. Use only one # character.',
        };
    }

    const [name, number] = parts;

    // Name part should have at least 1 character
    if (name.length === 0) {
        return {
            valid: false,
            error: 'Battle.net ID must have a name before the # character.',
        };
    }

    // Number part should be numeric and at least 4 digits
    if (!/^\d{4,}$/.test(number)) {
        return {
            valid: false,
            error: 'Battle.net ID must have at least 4 digits after the # character.\n\nExample: Player#1234',
        };
    }

    return { valid: true };
}

/**
 * Validates roles selection
 * At least one role must be selected
 */
export function validateRoles(roles: Role[]): ValidationResult {
    if (roles.length === 0) {
        return {
            valid: false,
            error: 'Please select at least one role.',
        };
    }

    return { valid: true };
}

/**
 * Validates rank selection
 */
export function validateRank(rank: Rank | null): ValidationResult {
    if (rank === null) {
        return {
            valid: false,
            error: 'Please select a rank.',
        };
    }

    const validRanks: Rank[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster'];
    if (!validRanks.includes(rank)) {
        return {
            valid: false,
            error: 'Invalid rank selected.',
        };
    }

    return { valid: true };
}

/**
 * Validates that all registration data is complete
 */
export function validateRegistrationComplete(data: RegistrationData): ValidationResult {
    // Validate Battle.net ID
    if (!data.battlenetId) {
        return {
            valid: false,
            error: 'Battle.net ID is required.',
        };
    }

    const battlenetValidation = validateBattlenetId(data.battlenetId);
    if (!battlenetValidation.valid) {
        return battlenetValidation;
    }

    // Validate roles
    const rolesValidation = validateRoles(data.selectedRoles);
    if (!rolesValidation.valid) {
        return rolesValidation;
    }

    // Validate rank
    const rankValidation = validateRank(data.selectedRank);
    if (!rankValidation.valid) {
        return rankValidation;
    }

    return { valid: true };
}

/**
 * Quick check if registration is complete (returns boolean only)
 */
export function isRegistrationComplete(data: RegistrationData): boolean {
    return validateRegistrationComplete(data).valid;
}
