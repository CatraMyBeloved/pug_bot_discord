import {Channel, ChannelType, Guild, Role} from 'discord.js';
import {WizardSettings} from './WizardState';

export interface ValidationResult {
    valid: boolean;
    error?: string;
    channel?: Channel;
    role?: Role;
}

export async function validateChannelId(
    guild: Guild,
    channelId: string,
    expectedType: ChannelType
): Promise<ValidationResult> {
    // Format validation
    if (!/^\d{17,20}$/.test(channelId)) {
        return {
            valid: false,
            error: 'Invalid channel ID format. Please provide a valid Discord ID (17-20 digits).'
        };
    }

    // Fetch channel
    let channel;
    try {
        channel = await guild.channels.fetch(channelId);
        if (!channel) {
            return {
                valid: false,
                error: 'Channel not found in this server. Please check the ID and try again.'
            };
        }
    } catch (error) {
        return {
            valid: false,
            error: 'Channel not found or bot lacks access to it.'
        };
    }

    // Type validation
    if (channel.type !== expectedType) {
        const expectedTypeName = expectedType === ChannelType.GuildVoice ? 'voice channel' : 'text channel';
        const actualTypeName = channel.type === ChannelType.GuildVoice ? 'voice channel' : 'text channel';
        return {
            valid: false,
            error: `This must be a ${expectedTypeName}. You provided a ${actualTypeName}.`
        };
    }

    return {
        valid: true,
        channel
    };
}

export async function validateRoleId(
    guild: Guild,
    roleId: string
): Promise<ValidationResult> {
    // Format validation
    if (!/^\d{17,20}$/.test(roleId)) {
        return {
            valid: false,
            error: 'Invalid role ID format. Please provide a valid Discord ID (17-20 digits).'
        };
    }

    // Fetch role
    let role;
    try {
        role = await guild.roles.fetch(roleId);
        if (!role) {
            return {
                valid: false,
                error: 'Role not found in this server. Please check the ID and try again.'
            };
        }
    } catch (error) {
        return {
            valid: false,
            error: 'Role not found in this server.'
        };
    }

    // Check if it's @everyone (usually not desired)
    if (role.id === guild.id) {
        return {
            valid: false,
            error: 'You cannot use the @everyone role. Please select a specific role.'
        };
    }

    return {
        valid: true,
        role
    };
}

export function validateVoiceChannelUniqueness(
    mainVc: string | null,
    team1Vc: string | null,
    team2Vc: string | null
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!mainVc || !team1Vc || !team2Vc) {
        // Not all channels set yet
        return { valid: true, errors: [] };
    }

    if (mainVc === team1Vc) {
        errors.push('Main VC and Team 1 VC cannot be the same channel.');
    }

    if (mainVc === team2Vc) {
        errors.push('Main VC and Team 2 VC cannot be the same channel.');
    }

    if (team1Vc === team2Vc) {
        errors.push('Team 1 VC and Team 2 VC cannot be the same channel.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export function getValidationErrors(settings: WizardSettings): string[] {
    const errors: string[] = [];

    // Voice channels
    if (!settings.mainVcId) {
        errors.push('Main VC not configured');
    }
    if (!settings.team1VcId) {
        errors.push('Team 1 VC not configured');
    }
    if (!settings.team2VcId) {
        errors.push('Team 2 VC not configured');
    }

    // Check uniqueness
    const uniqueness = validateVoiceChannelUniqueness(
        settings.mainVcId,
        settings.team1VcId,
        settings.team2VcId
    );
    if (!uniqueness.valid) {
        errors.push(...uniqueness.errors);
    }

    // Roles
    if (!settings.pugRoleId) {
        errors.push('PUG Role not configured');
    }
    if (settings.pugLeaderRoleIds.length === 0) {
        errors.push('At least one PUG Leader role required');
    }

    // Announcements
    if (!settings.announcementChannelId) {
        errors.push('Announcement Channel not configured');
    }

    return errors;
}

export function isWizardComplete(settings: WizardSettings): boolean {
    return getValidationErrors(settings).length === 0;
}
