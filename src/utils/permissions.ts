import {GuildMember, PermissionFlagsBits} from 'discord.js';
import {GuildConfig} from '../database/config';

/**
 * Check if a member has permission to manage matches
 *
 * Permission is granted if:
 * 1. Member has Administrator permission, OR
 * 2. Member has the configured PUG Leader role
 *
 * If no PUG Leader role is configured, only Administrators can manage matches.
 */
export function hasMatchPermission(
    member: GuildMember,
    guildConfig: GuildConfig | undefined
): boolean {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    if (guildConfig?.pug_leader_role_id) {
        return member.roles.cache.has(guildConfig.pug_leader_role_id);
    }

    return false;
}
