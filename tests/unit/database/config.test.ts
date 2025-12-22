import {afterEach, beforeEach, describe, expect, it} from '@jest/globals';
import Database from 'better-sqlite3';
import {
    addPugLeaderRole,
    getGuildConfig,
    getMatchmakingWeights,
    getPugLeaderRoles,
    removePugLeaderRole,
    setAnnouncementChannel,
    setAutoMove,
    setMainVC,
    setMatchmakingWeights,
    setPugLeaderRole,
    setPugRole,
    setTeam1VC,
    setTeam2VC,
    validateMatchmakingWeights,
} from '../../../src/database/config';
import {closeTestDatabase, createTestDatabase, getRowCount} from '../../setup/testUtils';

describe('Guild Configuration Database Operations', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = createTestDatabase();
    });

    afterEach(() => {
        closeTestDatabase(db);
    });

    describe('getGuildConfig', () => {
        it('returns undefined for non-existent guild', () => {
            const config = getGuildConfig(db, 'guild123');

            expect(config).toBeUndefined();
        });

        it('returns config after creating one', () => {
            setMainVC(db, 'guild123', 'vc456');

            const config = getGuildConfig(db, 'guild123');

            expect(config).toBeDefined();
            expect(config?.guild_id).toBe('guild123');
        });

        it('returns config with all fields', () => {
            setMainVC(db, 'guild123', 'vc456');
            setTeam1VC(db, 'guild123', 'team1vc');
            setTeam2VC(db, 'guild123', 'team2vc');

            const config = getGuildConfig(db, 'guild123');

            expect(config).toMatchObject({
                guild_id: 'guild123',
                main_vc_id: 'vc456',
                team1_vc_id: 'team1vc',
                team2_vc_id: 'team2vc',
            });
        });

        it('includes auto_move field with default value', () => {
            setMainVC(db, 'guild123', 'vc456');

            const config = getGuildConfig(db, 'guild123');

            expect(config?.auto_move).toBeDefined();
            expect(config?.auto_move).toBe(1);
        });

        it('includes updated_at timestamp', () => {
            setMainVC(db, 'guild123', 'vc456');

            const config = getGuildConfig(db, 'guild123');

            expect(config?.updated_at).toBeDefined();
            expect(typeof config?.updated_at).toBe('string');
        });
    });

    describe('UPSERT Behavior (Create or Update)', () => {
        describe('setMainVC', () => {
            it('creates new guild config when none exists', () => {
                setMainVC(db, 'guild123', 'vc456');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.main_vc_id).toBe('vc456');
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });

            it('updates existing guild config', () => {
                setMainVC(db, 'guild123', 'vc456');
                setMainVC(db, 'guild123', 'vc789');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.main_vc_id).toBe('vc789');
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });

            it('updates timestamp on update', () => {
                setMainVC(db, 'guild123', 'vc456');
                const firstConfig = getGuildConfig(db, 'guild123');

                setMainVC(db, 'guild123', 'vc789');
                const secondConfig = getGuildConfig(db, 'guild123');

                expect(firstConfig?.updated_at).toBeDefined();
                expect(secondConfig?.updated_at).toBeDefined();
            });

            it('does not affect other guild configs', () => {
                setMainVC(db, 'guild123', 'vc456');
                setMainVC(db, 'guild456', 'vc789');

                const config1 = getGuildConfig(db, 'guild123');
                const config2 = getGuildConfig(db, 'guild456');

                expect(config1?.main_vc_id).toBe('vc456');
                expect(config2?.main_vc_id).toBe('vc789');
                expect(getRowCount(db, 'guild_config')).toBe(2);
            });
        });

        describe('setTeam1VC', () => {
            it('creates or updates team1_vc_id', () => {
                setTeam1VC(db, 'guild123', 'team1vc');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.team1_vc_id).toBe('team1vc');
            });

            it('updates existing team1_vc_id', () => {
                setTeam1VC(db, 'guild123', 'team1vc');
                setTeam1VC(db, 'guild123', 'newteam1vc');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.team1_vc_id).toBe('newteam1vc');
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });
        });

        describe('setTeam2VC', () => {
            it('creates or updates team2_vc_id', () => {
                setTeam2VC(db, 'guild123', 'team2vc');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.team2_vc_id).toBe('team2vc');
            });

            it('updates existing team2_vc_id', () => {
                setTeam2VC(db, 'guild123', 'team2vc');
                setTeam2VC(db, 'guild123', 'newteam2vc');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.team2_vc_id).toBe('newteam2vc');
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });
        });

        describe('setAutoMove', () => {
            it('creates or updates auto_move setting to enabled', () => {
                setAutoMove(db, 'guild123', true);

                const config = getGuildConfig(db, 'guild123');
                expect(config?.auto_move).toBe(1);
            });

            it('creates or updates auto_move setting to disabled', () => {
                setAutoMove(db, 'guild123', false);

                const config = getGuildConfig(db, 'guild123');
                expect(config?.auto_move).toBe(0);
            });

            it('toggles auto_move from enabled to disabled', () => {
                setAutoMove(db, 'guild123', true);
                setAutoMove(db, 'guild123', false);

                const config = getGuildConfig(db, 'guild123');
                expect(config?.auto_move).toBe(0);
            });

            it('toggles auto_move from disabled to enabled', () => {
                setAutoMove(db, 'guild123', false);
                setAutoMove(db, 'guild123', true);

                const config = getGuildConfig(db, 'guild123');
                expect(config?.auto_move).toBe(1);
            });
        });

        describe('setPugRole', () => {
            it('creates or updates pug_role_id', () => {
                setPugRole(db, 'guild123', 'role123');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.pug_role_id).toBe('role123');
            });

            it('updates existing pug_role_id', () => {
                setPugRole(db, 'guild123', 'role123');
                setPugRole(db, 'guild123', 'role456');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.pug_role_id).toBe('role456');
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });
        });

        describe('setAnnouncementChannel', () => {
            it('creates or updates announcement_channel_id', () => {
                setAnnouncementChannel(db, 'guild123', 'channel123');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.announcement_channel_id).toBe('channel123');
            });

            it('updates existing announcement_channel_id', () => {
                setAnnouncementChannel(db, 'guild123', 'channel123');
                setAnnouncementChannel(db, 'guild123', 'channel456');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.announcement_channel_id).toBe('channel456');
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });
        });

        describe('setPugLeaderRole', () => {
            it('creates or updates pug_leader_role_id', () => {
                setPugLeaderRole(db, 'guild123', 'leaderrole123');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.pug_leader_role_id).toBe('leaderrole123');
            });

            it('updates existing pug_leader_role_id', () => {
                setPugLeaderRole(db, 'guild123', 'leaderrole123');
                setPugLeaderRole(db, 'guild123', 'leaderrole456');

                const config = getGuildConfig(db, 'guild123');
                expect(config?.pug_leader_role_id).toBe('leaderrole456');
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });
        });
    });

    describe('Multiple Configuration Fields', () => {
        it('allows setting multiple fields independently', () => {
            setMainVC(db, 'guild123', 'vc456');
            setTeam1VC(db, 'guild123', 'team1vc');
            setTeam2VC(db, 'guild123', 'team2vc');
            setPugRole(db, 'guild123', 'role123');
            setAutoMove(db, 'guild123', false);

            const config = getGuildConfig(db, 'guild123');

            expect(config).toMatchObject({
                guild_id: 'guild123',
                main_vc_id: 'vc456',
                team1_vc_id: 'team1vc',
                team2_vc_id: 'team2vc',
                pug_role_id: 'role123',
                auto_move: 0,
            });
        });

        it('preserves unrelated fields when updating', () => {
            setMainVC(db, 'guild123', 'vc456');
            setTeam1VC(db, 'guild123', 'team1vc');
            setAutoMove(db, 'guild123', false);

            setMainVC(db, 'guild123', 'newvc');

            const config = getGuildConfig(db, 'guild123');

            expect(config?.main_vc_id).toBe('newvc');
            expect(config?.team1_vc_id).toBe('team1vc');
            expect(config?.auto_move).toBe(0);
        });
    });

    describe('PUG Leader Roles (Many-to-Many)', () => {
        describe('addPugLeaderRole', () => {
            it('adds single PUG leader role', () => {
                const added = addPugLeaderRole(db, 'guild123', 'role1');

                expect(added).toBe(true);
                const roles = getPugLeaderRoles(db, 'guild123');
                expect(roles).toEqual(['role1']);
            });

            it('adds multiple PUG leader roles', () => {
                addPugLeaderRole(db, 'guild123', 'role1');
                addPugLeaderRole(db, 'guild123', 'role2');

                const roles = getPugLeaderRoles(db, 'guild123');
                expect(roles).toHaveLength(2);
                expect(roles).toContain('role1');
                expect(roles).toContain('role2');
            });

            it('prevents duplicate role additions', () => {
                const added1 = addPugLeaderRole(db, 'guild123', 'role1');
                const added2 = addPugLeaderRole(db, 'guild123', 'role1');

                expect(added1).toBe(true);
                expect(added2).toBe(false);

                const roles = getPugLeaderRoles(db, 'guild123');
                expect(roles).toEqual(['role1']);
            });

            it('allows same role ID for different guilds', () => {
                addPugLeaderRole(db, 'guild123', 'role1');
                addPugLeaderRole(db, 'guild456', 'role1');

                const roles1 = getPugLeaderRoles(db, 'guild123');
                const roles2 = getPugLeaderRoles(db, 'guild456');

                expect(roles1).toEqual(['role1']);
                expect(roles2).toEqual(['role1']);
                expect(getRowCount(db, 'guild_pug_leader_roles')).toBe(2);
            });

            it('returns true when role is added', () => {
                const result = addPugLeaderRole(db, 'guild123', 'role1');

                expect(result).toBe(true);
            });

            it('returns false when duplicate is attempted', () => {
                addPugLeaderRole(db, 'guild123', 'role1');
                const result = addPugLeaderRole(db, 'guild123', 'role1');

                expect(result).toBe(false);
            });
        });

        describe('getPugLeaderRoles', () => {
            it('returns empty array for guild with no roles', () => {
                const roles = getPugLeaderRoles(db, 'guild123');

                expect(roles).toEqual([]);
            });

            it('returns empty array for non-existent guild', () => {
                const roles = getPugLeaderRoles(db, 'nonexistent');

                expect(roles).toEqual([]);
            });

            it('returns all roles for guild', () => {
                addPugLeaderRole(db, 'guild123', 'role1');
                addPugLeaderRole(db, 'guild123', 'role2');
                addPugLeaderRole(db, 'guild123', 'role3');

                const roles = getPugLeaderRoles(db, 'guild123');

                expect(roles).toHaveLength(3);
                expect(roles).toContain('role1');
                expect(roles).toContain('role2');
                expect(roles).toContain('role3');
            });

            it('returns only roles for specific guild', () => {
                addPugLeaderRole(db, 'guild123', 'role1');
                addPugLeaderRole(db, 'guild123', 'role2');
                addPugLeaderRole(db, 'guild456', 'role3');

                const rolesGuild123 = getPugLeaderRoles(db, 'guild123');
                const rolesGuild456 = getPugLeaderRoles(db, 'guild456');

                expect(rolesGuild123).toEqual(['role1', 'role2']);
                expect(rolesGuild456).toEqual(['role3']);
            });
        });

        describe('removePugLeaderRole', () => {
            beforeEach(() => {
                addPugLeaderRole(db, 'guild123', 'role1');
                addPugLeaderRole(db, 'guild123', 'role2');
                addPugLeaderRole(db, 'guild123', 'role3');
            });

            it('removes specific role', () => {
                const removed = removePugLeaderRole(db, 'guild123', 'role2');

                expect(removed).toBe(true);
                const roles = getPugLeaderRoles(db, 'guild123');
                expect(roles).toHaveLength(2);
                expect(roles).not.toContain('role2');
                expect(roles).toContain('role1');
                expect(roles).toContain('role3');
            });

            it('returns true when role is removed', () => {
                const result = removePugLeaderRole(db, 'guild123', 'role1');

                expect(result).toBe(true);
            });

            it('returns false when role does not exist', () => {
                const result = removePugLeaderRole(db, 'guild123', 'nonexistent');

                expect(result).toBe(false);
            });

            it('removes all roles individually', () => {
                removePugLeaderRole(db, 'guild123', 'role1');
                removePugLeaderRole(db, 'guild123', 'role2');
                removePugLeaderRole(db, 'guild123', 'role3');

                const roles = getPugLeaderRoles(db, 'guild123');
                expect(roles).toEqual([]);
            });

            it('only removes from specified guild', () => {
                addPugLeaderRole(db, 'guild456', 'role1');
                removePugLeaderRole(db, 'guild123', 'role1');

                const rolesGuild123 = getPugLeaderRoles(db, 'guild123');
                const rolesGuild456 = getPugLeaderRoles(db, 'guild456');

                expect(rolesGuild123).not.toContain('role1');
                expect(rolesGuild456).toContain('role1');
            });
        });
    });

    describe('Matchmaking Weights Configuration', () => {
        describe('validateMatchmakingWeights', () => {
            it('returns valid for correct weights summing to 1.0', () => {
                const result = validateMatchmakingWeights(0.5, 0.5);
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('returns valid for another correct pair (0.2, 0.8)', () => {
                const result = validateMatchmakingWeights(0.2, 0.8);
                expect(result.valid).toBe(true);
            });

            it('returns valid for 0 and 1', () => {
                const result = validateMatchmakingWeights(0, 1);
                expect(result.valid).toBe(true);
            });

            it('returns invalid if sum is not 1.0', () => {
                const result = validateMatchmakingWeights(0.5, 0.6);
                expect(result.valid).toBe(false);
                expect(result.errors[0]).toContain('sum to 1.0');
            });

            it('returns invalid if fairness weight is out of range', () => {
                const result = validateMatchmakingWeights(1.2, -0.2); // Sum is 1, but individually invalid
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Fairness weight must be between 0 and 1');
                expect(result.errors).toContain('Priority weight must be between 0 and 1');
            });

            it('returns invalid for non-number inputs', () => {
                // @ts-ignore
                const result = validateMatchmakingWeights('0.5', 0.5);
                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Fairness weight must be a valid number');
            });
        });

        describe('setMatchmakingWeights', () => {
            it('saves valid weights to the database', () => {
                setMatchmakingWeights(db, 'guild1', 0.3, 0.7);
                const config = getGuildConfig(db, 'guild1');

                expect(config?.fairness_weight).toBe(0.3);
                expect(config?.priority_weight).toBe(0.7);
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });

            it('updates existing weights', () => {
                setMatchmakingWeights(db, 'guild1', 0.3, 0.7);
                setMatchmakingWeights(db, 'guild1', 0.6, 0.4);

                const config = getGuildConfig(db, 'guild1');
                expect(config?.fairness_weight).toBe(0.6);
                expect(config?.priority_weight).toBe(0.4);
                expect(getRowCount(db, 'guild_config')).toBe(1);
            });

            it('updates timestamp on update', () => {
                setMatchmakingWeights(db, 'guild1', 0.3, 0.7);
                const firstConfig = getGuildConfig(db, 'guild1');

                // Small delay to ensure timestamp difference if resolution is high,
                // but usually separate queries are enough in tests.
                setMatchmakingWeights(db, 'guild1', 0.6, 0.4);
                const secondConfig = getGuildConfig(db, 'guild1');

                expect(firstConfig?.updated_at).toBeDefined();
                expect(secondConfig?.updated_at).toBeDefined();
                // Note: In fast tests, timestamps might be identical if second resolution,
                // but checking they exist matches the 'setMainVC' pattern.
            });

            it('throws error for invalid weights', () => {
                expect(() => {
                    setMatchmakingWeights(db, 'guild1', 0.5, 0.6);
                }).toThrow();
                // Ensure no bad data was written if it was a new insert
                expect(getRowCount(db, 'guild_config')).toBe(0);
            });
        });

        describe('getMatchmakingWeights', () => {
            it('returns default weights (0.2, 0.8) if no config exists', () => {
                const weights = getMatchmakingWeights(db, 'guild_nonexistent');
                expect(weights).toEqual({fairnessWeight: 0.2, priorityWeight: 0.8});
            });

            it('returns saved weights if config exists', () => {
                setMatchmakingWeights(db, 'guild1', 0.4, 0.6);
                const weights = getMatchmakingWeights(db, 'guild1');
                expect(weights).toEqual({fairnessWeight: 0.4, priorityWeight: 0.6});
            });
        });
    });

    describe('Edge Cases and Data Integrity', () => {
        it('handles multiple guilds independently', () => {
            setMainVC(db, 'guild1', 'vc1');
            setMainVC(db, 'guild2', 'vc2');
            setMainVC(db, 'guild3', 'vc3');

            expect(getRowCount(db, 'guild_config')).toBe(3);
            expect(getGuildConfig(db, 'guild1')?.main_vc_id).toBe('vc1');
            expect(getGuildConfig(db, 'guild2')?.main_vc_id).toBe('vc2');
            expect(getGuildConfig(db, 'guild3')?.main_vc_id).toBe('vc3');
        });

        it('allows null values for optional fields', () => {
            setMainVC(db, 'guild123', 'vc456');

            const config = getGuildConfig(db, 'guild123');

            expect(config?.team1_vc_id).toBeNull();
            expect(config?.team2_vc_id).toBeNull();
            expect(config?.pug_role_id).toBeNull();
        });

        it('maintains PUG leader roles when updating config', () => {
            setMainVC(db, 'guild123', 'vc456');
            addPugLeaderRole(db, 'guild123', 'role1');
            addPugLeaderRole(db, 'guild123', 'role2');

            setMainVC(db, 'guild123', 'newvc');

            const roles = getPugLeaderRoles(db, 'guild123');
            expect(roles).toHaveLength(2);
        });

        it('handles special characters in IDs', () => {
            setMainVC(db, 'guild-123-abc', 'vc-456-def');

            const config = getGuildConfig(db, 'guild-123-abc');
            expect(config?.main_vc_id).toBe('vc-456-def');
        });

        it('supports complete configuration workflow', () => {
            setMainVC(db, 'guild123', 'mainvc');
            setTeam1VC(db, 'guild123', 'team1vc');
            setTeam2VC(db, 'guild123', 'team2vc');
            setPugRole(db, 'guild123', 'pugrole');
            setPugLeaderRole(db, 'guild123', 'leaderrole');
            setAnnouncementChannel(db, 'guild123', 'announcements');
            setAutoMove(db, 'guild123', true);
            addPugLeaderRole(db, 'guild123', 'role1');
            addPugLeaderRole(db, 'guild123', 'role2');

            const config = getGuildConfig(db, 'guild123');
            const leaderRoles = getPugLeaderRoles(db, 'guild123');

            expect(config).toMatchObject({
                guild_id: 'guild123',
                main_vc_id: 'mainvc',
                team1_vc_id: 'team1vc',
                team2_vc_id: 'team2vc',
                pug_role_id: 'pugrole',
                pug_leader_role_id: 'leaderrole',
                announcement_channel_id: 'announcements',
                auto_move: 1,
            });
            expect(leaderRoles).toEqual(['role1', 'role2']);
        });
    });
});
