import {ButtonInteraction, GuildMember, MessageFlags} from 'discord.js';
import Database from 'better-sqlite3';
import {cancelScheduledPug, getScheduledPug} from '../database/scheduled_pugs';
import {getGuildConfig, getPugLeaderRoles} from '../database/config';
import {hasMatchPermission} from '../utils/permissions';

export async function handleCancelpugButton(
    interaction: ButtonInteraction,
    db: Database.Database
) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'This can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const member = interaction.member as GuildMember;
    const config = getGuildConfig(db, interaction.guildId);
    const pugLeaderRoles = getPugLeaderRoles(db, interaction.guildId);

    // Check permissions
    if (!hasMatchPermission(member, config, pugLeaderRoles)) {
        await interaction.reply({
            content: "You don't have permission to cancel matches.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const customId = interaction.customId;

    // Parse button ID: confirm_cancel_123 or decline_cancel_123
    const parts = customId.split('_');
    const action = parts[0]; // "confirm" or "decline"
    const pugId = parseInt(parts[2], 10);

    if (isNaN(pugId)) {
        await interaction.reply({
            content: 'Invalid PUG ID.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Fetch the PUG to verify it exists
    const pug = getScheduledPug(db, pugId);
    if (!pug) {
        await interaction.update({
            content: `PUG with ID ${pugId} not found.`,
            components: [], // Remove buttons
        });
        return;
    }

    if (pug.guild_id !== interaction.guildId) {
        await interaction.reply({
            content: 'This PUG does not belong to this server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (pug.state !== 'pending') {
        await interaction.update({
            content: `This PUG is already ${pug.state} and cannot be cancelled.`,
            components: [],
        });
        return;
    }

    if (action === 'confirm') {
        // User confirmed cancellation
        try {
            // Delete Discord event if it exists
            if (pug.discord_event_id) {
                try {
                    const event = await interaction.guild.scheduledEvents.fetch(pug.discord_event_id);
                    await event.delete();
                } catch (error) {
                    console.warn(`Could not delete Discord event ${pug.discord_event_id}:`, error);
                }
            }

            // Update database
            cancelScheduledPug(db, pugId);

            // Send announcement
            if (config && config.announcement_channel_id) {
                try {
                    const channel = await interaction.client.channels.fetch(config.announcement_channel_id);
                    if (channel && channel.isTextBased()) {
                        const timestamp = Math.floor(new Date(pug.scheduled_time).getTime() / 1000);
                        const roleMention = config.pug_role_id ? `<@&${config.pug_role_id}>` : '**PUG Update:**';

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

            // Update the interaction message
            await interaction.update({
                content: `**[CANCELLED]** Scheduled PUG ${pugId} has been cancelled successfully.`,
                components: [], // Remove buttons
            });
        } catch (error) {
            console.error('Cancel PUG error:', error);
            await interaction.update({
                content: 'Failed to cancel PUG. Please try again.',
                components: [],
            });
        }
    } else if (action === 'decline') {
        // User declined cancellation
        await interaction.update({
            content: `**[ABORTED]** Cancellation of PUG ${pugId} was aborted. The PUG is still scheduled.`,
            components: [], // Remove buttons
        });
    } else {
        await interaction.reply({
            content: 'Unknown action.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
