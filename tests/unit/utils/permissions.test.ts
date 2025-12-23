import {describe, expect, it} from '@jest/globals';
import {GuildMember, PermissionFlagsBits} from 'discord.js';
import {hasMatchPermission} from '../../../src/utils/permissions';
import {GuildConfig} from '../../../src/database/config';

describe('hasMatchPermission', () => {
    function createMockGuildMember(
        hasAdminPermission: boolean,
        roleIds: string[]
    ): GuildMember {
        return {
            permissions: {
                has: (permission: bigint) => {
                    if (permission === PermissionFlagsBits.Administrator) {
                        return hasAdminPermission;
                    }
                    return false;
                },
            },
            roles: {
                cache: {
                    has: (roleId: string) => roleIds.includes(roleId),
                },
            },
        } as unknown as GuildMember;
    }

    function createMockGuildConfig(pugLeaderRoleId: string | null): GuildConfig {
        return {
            guild_id: 'test-guild',
            main_vc_id: null,
            team1_vc_id: null,
            team2_vc_id: null,
            pug_role_id: null,
            pug_leader_role_id: pugLeaderRoleId,
            announcement_channel_id: null,
            auto_move: 1,
            fairness_weight: 0.2,
            priority_weight: 0.8,
            updated_at: '2025-01-01 00:00:00',
        };
    }

    describe('Administrator Permission', () => {
        it('grants permission to administrators regardless of roles', () => {
            const member = createMockGuildMember(true, []);
            const result = hasMatchPermission(member, undefined, []);

            expect(result).toBe(true);
        });

        it('grants permission to administrators with no guild config', () => {
            const member = createMockGuildMember(true, []);
            const result = hasMatchPermission(member, undefined, []);

            expect(result).toBe(true);
        });

        it('grants permission to administrators even with wrong roles', () => {
            const member = createMockGuildMember(true, ['wrong-role']);
            const config = createMockGuildConfig('correct-role');
            const result = hasMatchPermission(member, config, []);

            expect(result).toBe(true);
        });
    });

    describe('PUG Leader Roles Array', () => {
        it('grants permission when member has one of the specified roles', () => {
            const member = createMockGuildMember(false, ['role1', 'role3']);
            const pugLeaderRoles = ['role1', 'role2'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(true);
        });

        it('grants permission when member has any role from the array', () => {
            const member = createMockGuildMember(false, ['role2']);
            const pugLeaderRoles = ['role1', 'role2', 'role3'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(true);
        });

        it('denies permission when member has none of the specified roles', () => {
            const member = createMockGuildMember(false, ['role3', 'role4']);
            const pugLeaderRoles = ['role1', 'role2'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(false);
        });

        it('denies permission when roles array is empty', () => {
            const member = createMockGuildMember(false, ['some-role']);
            const pugLeaderRoles: string[] = [];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(false);
        });

        it('prioritizes role array over guild config', () => {
            const member = createMockGuildMember(false, ['array-role']);
            const config = createMockGuildConfig('config-role');
            const pugLeaderRoles = ['array-role'];

            const result = hasMatchPermission(member, config, pugLeaderRoles);

            expect(result).toBe(true);
        });
    });

    describe('Guild Config PUG Leader Role', () => {
        it('grants permission when member has the config role', () => {
            const member = createMockGuildMember(false, ['pug-leader-role']);
            const config = createMockGuildConfig('pug-leader-role');

            const result = hasMatchPermission(member, config, []);

            expect(result).toBe(true);
        });

        it('denies permission when member lacks the config role', () => {
            const member = createMockGuildMember(false, ['other-role']);
            const config = createMockGuildConfig('pug-leader-role');

            const result = hasMatchPermission(member, config, []);

            expect(result).toBe(false);
        });

        it('denies permission when guild config has no pug leader role', () => {
            const member = createMockGuildMember(false, ['any-role']);
            const config = createMockGuildConfig(null);

            const result = hasMatchPermission(member, config, []);

            expect(result).toBe(false);
        });
    });

    describe('No Configuration', () => {
        it('denies permission when no guild config and no roles provided', () => {
            const member = createMockGuildMember(false, ['any-role']);

            const result = hasMatchPermission(member, undefined, []);

            expect(result).toBe(false);
        });

        it('denies permission to non-admin with no configuration', () => {
            const member = createMockGuildMember(false, []);

            const result = hasMatchPermission(member, undefined, []);

            expect(result).toBe(false);
        });
    });

    describe('Priority Order', () => {
        it('checks admin first, then role array, then guild config', () => {
            const adminMember = createMockGuildMember(true, []);
            expect(hasMatchPermission(adminMember, undefined, [])).toBe(true);

            const roleArrayMember = createMockGuildMember(false, ['array-role']);
            const config = createMockGuildConfig('config-role');
            expect(hasMatchPermission(roleArrayMember, config, ['array-role'])).toBe(true);

            const configMember = createMockGuildMember(false, ['config-role']);
            expect(hasMatchPermission(configMember, config, [])).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('handles member with multiple roles', () => {
            const member = createMockGuildMember(false, ['role1', 'role2', 'role3', 'role4']);
            const pugLeaderRoles = ['role3'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(true);
        });

        it('handles empty member roles', () => {
            const member = createMockGuildMember(false, []);
            const pugLeaderRoles = ['required-role'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(false);
        });

        it('handles special characters in role IDs', () => {
            const member = createMockGuildMember(false, ['role-with-dashes_123']);
            const pugLeaderRoles = ['role-with-dashes_123'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(true);
        });

        it('handles case sensitivity in role IDs', () => {
            const member = createMockGuildMember(false, ['RoleID123']);
            const pugLeaderRoles = ['RoleID123'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(true);
        });

        it('does not match similar but different role IDs', () => {
            const member = createMockGuildMember(false, ['role123']);
            const pugLeaderRoles = ['role124'];

            const result = hasMatchPermission(member, undefined, pugLeaderRoles);

            expect(result).toBe(false);
        });
    });

    describe('Real-World Scenarios', () => {
        it('typical server setup with single pug leader role in config', () => {
            const admin = createMockGuildMember(true, []);
            const pugLeader = createMockGuildMember(false, ['pug-leader']);
            const regularUser = createMockGuildMember(false, ['member']);
            const config = createMockGuildConfig('pug-leader');

            expect(hasMatchPermission(admin, config, [])).toBe(true);
            expect(hasMatchPermission(pugLeader, config, [])).toBe(true);
            expect(hasMatchPermission(regularUser, config, [])).toBe(false);
        });

        it('server with multiple pug leader roles', () => {
            const admin = createMockGuildMember(true, []);
            const seniorLeader = createMockGuildMember(false, ['senior-leader']);
            const juniorLeader = createMockGuildMember(false, ['junior-leader']);
            const regularUser = createMockGuildMember(false, ['member']);
            const pugLeaderRoles = ['senior-leader', 'junior-leader'];

            expect(hasMatchPermission(admin, undefined, pugLeaderRoles)).toBe(true);
            expect(hasMatchPermission(seniorLeader, undefined, pugLeaderRoles)).toBe(true);
            expect(hasMatchPermission(juniorLeader, undefined, pugLeaderRoles)).toBe(true);
            expect(hasMatchPermission(regularUser, undefined, pugLeaderRoles)).toBe(false);
        });

        it('new server with no configuration (admin only)', () => {
            const admin = createMockGuildMember(true, []);
            const regularUser = createMockGuildMember(false, ['some-role']);

            expect(hasMatchPermission(admin, undefined, [])).toBe(true);
            expect(hasMatchPermission(regularUser, undefined, [])).toBe(false);
        });

        it('migrating from config role to role array', () => {
            const member = createMockGuildMember(false, ['new-role']);
            const config = createMockGuildConfig('old-role');
            const newRoles = ['new-role'];

            const resultWithNewRoles = hasMatchPermission(member, config, newRoles);
            expect(resultWithNewRoles).toBe(true);

            const resultWithoutNewRoles = hasMatchPermission(member, config, []);
            expect(resultWithoutNewRoles).toBe(false);
        });
    });
});
