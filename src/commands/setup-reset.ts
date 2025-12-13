import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    GuildMember,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig, getPugLeaderRoles} from '../database/config';
import {hasMatchPermission} from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('setup-reset')
    .setDescription('Reset all bot configuration for this server (DANGER: Cannot be undone!)');

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
            content: "You don't have permission to reset bot configuration. You need Administrator permission or a PUG Leader role.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Check if there's any config to reset
    if (!config && pugLeaderRoles.length === 0) {
        await interaction.reply({
            content: 'There is no configuration to reset. The bot is not configured yet.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Show confirmation dialog
    const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_reset_${interaction.guildId}`)
        .setLabel('⚠️ Yes, Reset Everything')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_reset_${interaction.guildId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(cancelButton, confirmButton);

    let configSummary = '**Current Configuration:**\n';
    if (config) {
        if (config.main_vc_id) configSummary += `- Main VC: <#${config.main_vc_id}>\n`;
        if (config.team1_vc_id) configSummary += `- Team 1 VC: <#${config.team1_vc_id}>\n`;
        if (config.team2_vc_id) configSummary += `- Team 2 VC: <#${config.team2_vc_id}>\n`;
        if (config.pug_role_id) configSummary += `- PUG Role: <@&${config.pug_role_id}>\n`;
        if (config.announcement_channel_id) configSummary += `- Announcement Channel: <#${config.announcement_channel_id}>\n`;
        configSummary += `- Auto-move: ${config.auto_move ? 'Enabled' : 'Disabled'}\n`;
    }
    if (pugLeaderRoles.length > 0) {
        configSummary += `- PUG Leader Roles: ${pugLeaderRoles.map(id => `<@&${id}>`).join(', ')}\n`;
    }

    await interaction.reply({
        content: `# ⚠️ Reset Bot Configuration\n\n${configSummary}\n**This will delete ALL bot configuration for this server.**\n\n**This action cannot be undone!**\n\nAre you sure you want to proceed?`,
        components: [row],
        flags: MessageFlags.Ephemeral
    });
}
