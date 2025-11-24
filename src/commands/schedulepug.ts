import {
    ChatInputCommandInteraction,
    GuildMember,
    GuildScheduledEventEntityType,
    GuildScheduledEventPrivacyLevel,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig, getPugLeaderRoles} from '../database/config';
import {createScheduledPug} from '../database/scheduled_pugs';
import {hasMatchPermission} from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('schedulepug')
    .setDescription('Schedule a PUG match (times in UTC)')
    .addStringOption(option =>
        option
            .setName('date')
            .setDescription('Date in YYYY-MM-DD format (e.g., 2025-01-20)')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option
            .setName('hour')
            .setDescription('Hour in UTC (0-23) - Check your timezone offset!')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(23)
    )
    .addIntegerOption(option =>
        option
            .setName('minute')
            .setDescription('Minute')
            .setRequired(true)
            .addChoices(
                {name: '00', value: 0},
                {name: '15', value: 15},
                {name: '30', value: 30},
                {name: '45', value: 45}
            )
    )
    .addStringOption(option =>
        option
            .setName('description')
            .setDescription('Event description')
            .setRequired(false)
    );

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const member = interaction.member as GuildMember;
    const config = getGuildConfig(db, interaction.guildId);
    const pugLeaderRoles = getPugLeaderRoles(db, interaction.guildId);

    if (!hasMatchPermission(member, config, pugLeaderRoles)) {
        await interaction.reply({
            content: "You don't have permission to schedule matches. Ask an admin to set up PUG Leader roles with `/setup pugleader add`.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!config || !config.announcement_channel_id) {
        await interaction.reply({
            content: 'Announcement channel not configured. Use `/setup announcementchannel` first.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const dateStr = interaction.options.getString('date', true);
    const hour = interaction.options.getInteger('hour', true);
    const minute = interaction.options.getInteger('minute', true);
    const description = interaction.options.getString('description') || 'PUG Match';

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        await interaction.reply({
            content: 'Invalid date format. Use YYYY-MM-DD (e.g., 2025-01-20)',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const scheduledTime = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00Z`);

    if (isNaN(scheduledTime.getTime())) {
        await interaction.reply({
            content: 'Invalid date or time.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const now = new Date();
    const hoursFromNow = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursFromNow < 2) {
        await interaction.reply({
            content: 'Scheduled time must be at least 2 hours in the future.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    try {
        let discordEventId: string | null = null;

        try {
            const event = await interaction.guild.scheduledEvents.create({
                name: description,
                description: 'Join the main voice channel for this PUG match!',
                scheduledStartTime: scheduledTime,
                privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                entityType: GuildScheduledEventEntityType.Voice,
                channel: config.main_vc_id || undefined,
            });
            discordEventId = event.id;
        } catch (error) {
            console.error('Error creating Discord event:', error);
        }

        const scheduledTimeStr = scheduledTime.toISOString();
        const pugId = createScheduledPug(
            db,
            interaction.guildId,
            scheduledTimeStr,
            interaction.user.id,
            discordEventId
        );

        const timestamp = Math.floor(scheduledTime.getTime() / 1000);
        let response = `PUG scheduled successfully!\n\n`;
        response += `**ID:** ${pugId}\n`;
        response += `**Time:** <t:${timestamp}:F> \n`;
        response += `**Description:** ${description}\n`;

        if (discordEventId) {
            const event = await interaction.guild.scheduledEvents.fetch(discordEventId);
            response += `**Event:** ${event.url}\n`;
        }

        response += `\nReminders will be sent 24 hours and 1 hour before the event.`;
        response += `\n\n[NOTE] Times are entered in UTC. Discord will show the time in each user's local timezone.`;

        await interaction.reply({
            content: response,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('Schedule error:', error);
        await interaction.reply({
            content: 'Failed to schedule PUG. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
