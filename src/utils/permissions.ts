import {GuildMember, PermissionFlagsBits} from 'discord.js';
import {GuildConfig} from '../database/config';

/**
 * Check if a member has permission to manage matches
 *
 * Permission is granted if:
 * 1. Member has Administrator permission, OR
 * 2. Member has any of the configured PUG Leader roles
 *
 * If no PUG Leader roles are configured, only Administrators can manage matches.
 */
export function hasMatchPermission(
    member: GuildMember,
    guildConfig: GuildConfig | undefined,
    pugLeaderRoles: string[] = []
): boolean {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    if (pugLeaderRoles.length > 0) {
        return pugLeaderRoles.some(roleId => member.roles.cache.has(roleId));
    }

    if (guildConfig?.pug_leader_role_id) {
        return member.roles.cache.has(guildConfig.pug_leader_role_id);
    }

    return false;
}
