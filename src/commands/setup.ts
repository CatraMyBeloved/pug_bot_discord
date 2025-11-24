import {
    ChannelType,
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import {
    addPugLeaderRole,
    getGuildConfig,
    getPugLeaderRoles,
    removePugLeaderRole,
    setAnnouncementChannel,
    setAutoMove,
    setMainVC,
    setPugRole,
    setTeam1VC,
    setTeam2VC
} from '../database/config';
import {hasMatchPermission} from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure PUG bot settings (Admin or PUG Leader)')
    .addSubcommand(subcommand =>
        subcommand
            .setName('mainvc')
            .setDescription('Set the main voice channel (lobby)')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The voice channel')
                    .addChannelTypes(ChannelType.GuildVoice)
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('team1vc')
            .setDescription('Set Team 1 voice channel')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The voice channel')
                    .addChannelTypes(ChannelType.GuildVoice)
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('team2vc')
            .setDescription('Set Team 2 voice channel')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The voice channel')
                    .addChannelTypes(ChannelType.GuildVoice)
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('automove')
            .setDescription('Toggle automatic player movement to team VCs')
            .addBooleanOption(option =>
                option
                    .setName('enabled')
                    .setDescription('Enable or disable auto-move')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('pugrole')
            .setDescription('Set the PUG role for players who want to participate')
            .addRoleOption(option =>
                option
                    .setName('role')
                    .setDescription('The role to assign to PUG players')
                    .setRequired(true)
            )
    )
    .addSubcommandGroup(group =>
        group
            .setName('pugleader')
            .setDescription('Manage PUG Leader roles')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a role that can manage PUGs')
                    .addRoleOption(option =>
                        option
                            .setName('role')
                            .setDescription('The role to add')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a role from managing PUGs')
                    .addRoleOption(option =>
                        option
                            .setName('role')
                            .setDescription('The role to remove')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all PUG Leader roles')
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('announcementchannel')
            .setDescription('Set the channel for PUG announcements and reminders')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The text channel')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('View current configuration')
    );

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const config = getGuildConfig(db, interaction.guildId);
    const pugLeaderRoles = getPugLeaderRoles(db, interaction.guildId);
    if (!hasMatchPermission(interaction.member as any, config, pugLeaderRoles)) {
        await interaction.reply({
            content: 'You need Administrator permission or a PUG Leader role to use this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    try {
        switch (subcommand) {
            case 'mainvc': {
                const channel = interaction.options.getChannel('channel', true);
                setMainVC(db, interaction.guildId, channel.id);
                await interaction.reply({
                    content: `Main voice channel set to ${channel}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case 'team1vc': {
                const channel = interaction.options.getChannel('channel', true);
                setTeam1VC(db, interaction.guildId, channel.id);
                await interaction.reply({
                    content: `Team 1 voice channel set to ${channel}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case 'team2vc': {
                const channel = interaction.options.getChannel('channel', true);
                setTeam2VC(db, interaction.guildId, channel.id);
                await interaction.reply({
                    content: `Team 2 voice channel set to ${channel}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case 'automove': {
                const enabled = interaction.options.getBoolean('enabled', true);
                setAutoMove(db, interaction.guildId, enabled);
                await interaction.reply({
                    content: `Auto-move ${enabled ? 'enabled' : 'disabled'}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case 'pugrole': {
                const role = interaction.options.getRole('role', true);
                setPugRole(db, interaction.guildId, role.id);
                await interaction.reply({
                    content: `PUG role set to ${role}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case 'add': {
                if (subcommandGroup !== 'pugleader') break;
                const role = interaction.options.getRole('role', true);
                const added = addPugLeaderRole(db, interaction.guildId, role.id);
                if (added) {
                    await interaction.reply({
                        content: `Added ${role} as a PUG Leader role.\n\nUsers with this role can now create and manage matches.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        content: `${role} is already a PUG Leader role.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                break;
            }

            case 'remove': {
                if (subcommandGroup !== 'pugleader') break;
                const role = interaction.options.getRole('role', true);
                const removed = removePugLeaderRole(db, interaction.guildId, role.id);
                if (removed) {
                    await interaction.reply({
                        content: `Removed ${role} from PUG Leader roles.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        content: `${role} was not a PUG Leader role.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                break;
            }

            case 'list': {
                if (subcommandGroup !== 'pugleader') break;
                const roles = getPugLeaderRoles(db, interaction.guildId);
                if (roles.length === 0) {
                    await interaction.reply({
                        content: 'No PUG Leader roles configured. Only Administrators can manage matches.',
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    const roleList = roles.map(id => `<@&${id}>`).join('\n');
                    await interaction.reply({
                        content: `**PUG Leader Roles:**\n${roleList}`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                break;
            }

            case 'announcementchannel': {
                const channel = interaction.options.getChannel('channel', true);
                setAnnouncementChannel(db, interaction.guildId, channel.id);
                await interaction.reply({
                    content: `Announcement channel set to ${channel}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case 'view': {
                const config = getGuildConfig(db, interaction.guildId);

                if (!config) {
                    await interaction.reply({
                        content: 'No configuration found. Use `/setup` commands to configure the bot.',
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const mainVC = config.main_vc_id ? `<#${config.main_vc_id}>` : 'Not set';
                const team1VC = config.team1_vc_id ? `<#${config.team1_vc_id}>` : 'Not set';
                const team2VC = config.team2_vc_id ? `<#${config.team2_vc_id}>` : 'Not set';
                const pugRole = config.pug_role_id ? `<@&${config.pug_role_id}>` : 'Not set';
                const leaderRoles = getPugLeaderRoles(db, interaction.guildId);
                const pugLeaderRolesDisplay = leaderRoles.length > 0
                    ? leaderRoles.map(id => `<@&${id}>`).join(', ')
                    : 'Not set';
                const announcementChannel = config.announcement_channel_id ? `<#${config.announcement_channel_id}>` : 'Not set';
                const autoMove = config.auto_move === 1 ? 'Enabled' : 'Disabled';

                await interaction.reply({
                    content: `**Current Configuration:**

**Main VC:** ${mainVC}
**Team 1 VC:** ${team1VC}
**Team 2 VC:** ${team2VC}
**PUG Role:** ${pugRole}
**PUG Leader Roles:** ${pugLeaderRolesDisplay}
**Announcement Channel:** ${announcementChannel}
**Auto-move:** ${autoMove}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }
        }
    } catch (error) {
        console.error('Setup error:', error);
        await interaction.reply({
            content: 'Setup failed. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}