import {ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {cancelScheduledPug, getScheduledPug} from '../database/scheduled_pugs';
import {getGuildConfig} from '../database/config';

export const data = new SlashCommandBuilder()
    .setName('cancelpug')
    .setDescription('Cancel a scheduled PUG')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
        option
            .setName('pug_id')
            .setDescription('The ID of the scheduled PUG to cancel')
            .setRequired(true)
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

    const pugId = interaction.options.getInteger('pug_id', true);

    try {
        const pug = getScheduledPug(db, pugId);

        if (!pug) {
            await interaction.reply({
                content: `Scheduled PUG with ID ${pugId} not found.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (pug.guild_id !== interaction.guildId) {
            await interaction.reply({
                content: 'This scheduled PUG does not belong to this server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (pug.state !== 'pending') {
            await interaction.reply({
                content: `This PUG is already ${pug.state} and cannot be cancelled.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Delete Discord event if it exists
        if (pug.discord_event_id) {
            try {
                const event = await interaction.guild.scheduledEvents.fetch(pug.discord_event_id);
                event.delete();
            } catch (error) {
                console.warn(`Could not delete Discord event ${pug.discord_event_id}:`, error);
            }
        }

        cancelScheduledPug(db, pugId);

        const config = getGuildConfig(db, interaction.guildId);
        if (config && config.announcement_channel_id) {
            try {
                const channel = await interaction.client.channels.fetch(config.announcement_channel_id);
                if (channel && channel.isTextBased()) {
                    const timestamp = Math.floor(new Date(pug.scheduled_time).getTime() / 1000);
                    const roleMention = config.pug_role_id ? `<@&${config.pug_role_id}>` : '';

                    if ("send" in channel) {
                        await channel.send(
                            `${roleMention} The scheduled PUG for <t:${timestamp}:F> has been cancelled.`
                        );
                    }
                }
            } catch (error) {
                console.warn('Could not send cancellation message:', error);
            }
        }

        await interaction.reply({
            content: `Scheduled PUG ${pugId} has been cancelled.`,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('Cancel schedule error:', error);
        await interaction.reply({
            content: 'Failed to cancel scheduled PUG. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
