import {
    ChatInputCommandInteraction,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} from 'discord.js';
import Database from 'better-sqlite3';
import {wizardState} from '../wizard/WizardState';
import {buildMainMenuButtons, buildMainMenuEmbed} from '../wizard/wizardUI';
import {getGuildConfig, getPugLeaderRoles} from '../database/config';
import {hasMatchPermission} from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Interactive wizard to configure the PUG bot');

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const member = interaction.member as GuildMember;
    const config = getGuildConfig(db, interaction.guildId);
    const pugLeaderRoles = getPugLeaderRoles(db, interaction.guildId);

    // Check permissions
    if (!hasMatchPermission(member, config, pugLeaderRoles)) {
        await interaction.reply({
            content: "You don't have permission to configure the bot. You need Administrator permission or a PUG Leader role.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Check if user already has an active session
    const existingSession = wizardState.getSession(interaction.user.id, interaction.guildId);
    if (existingSession) {
        await interaction.reply({
            content: 'You already have an active setup wizard. Please complete or cancel it first.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        // Create new wizard session
        const session = wizardState.createSession(
            interaction.user.id,
            interaction.guildId,
            interaction.channelId
        );

        // Load existing configuration if available
        if (config) {
            if (config.main_vc_id) {
                session.settings.mainVcId = config.main_vc_id;
            }
            if (config.team1_vc_id) {
                session.settings.team1VcId = config.team1_vc_id;
            }
            if (config.team2_vc_id) {
                session.settings.team2VcId = config.team2_vc_id;
            }
            if (config.pug_role_id) {
                session.settings.pugRoleId = config.pug_role_id;
            }
            if (config.announcement_channel_id) {
                session.settings.announcementChannelId = config.announcement_channel_id;
            }
            session.settings.autoMove = config.auto_move === 1;
        }

        // Load existing PUG leader roles
        if (pugLeaderRoles.length > 0) {
            session.settings.pugLeaderRoleIds = pugLeaderRoles;
        }

        // Update completed categories based on loaded config
        wizardState.updateSettings(session.userId, session.guildId, session.settings);

        // Build initial UI
        const isComplete = wizardState.isComplete(session.userId, session.guildId);
        const embed = buildMainMenuEmbed(session);
        const buttons = buildMainMenuButtons(isComplete);

        // Send wizard message
        const reply = await interaction.reply({
            embeds: [embed],
            components: buttons,
            flags: MessageFlags.Ephemeral,
            fetchReply: true
        });

        // Store message ID for potential updates
        session.messageId = reply.id;

        // Start cleanup timer if not already running
        wizardState.startCleanupTimer();
    } catch (error) {
        console.error('Setup wizard error:', error);

        // Clean up session if it was created
        try {
            wizardState.deleteSession(interaction.user.id, interaction.guildId);
        } catch {}

        await interaction.reply({
            content: 'Failed to start setup wizard. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}
