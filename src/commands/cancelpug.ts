import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} from 'discord.js';
import Database from 'better-sqlite3';
import {cancelScheduledPug, getScheduledPug, getUpcomingPugs} from '../database/scheduled_pugs';
import {getGuildConfig, getPugLeaderRoles} from '../database/config';
import {hasMatchPermission} from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('cancelpug')
    .setDescription('Cancel a scheduled PUG')
    .addIntegerOption(option =>
        option
            .setName('pug_id')
            .setDescription('The ID of the scheduled PUG to cancel')
            .setRequired(true)
            .setAutocomplete(true)
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
            content: "You don't have permission to cancel matches. Ask an admin to set up PUG Leader roles with `/setup pugleader add`.",
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

export async function autocomplete(
    interaction: AutocompleteInteraction,
    db: Database.Database
) {
    if (!interaction.guildId) {
        await interaction.respond([]);
        return;
    }

    try {
        const pugs = getUpcomingPugs(db, interaction.guildId);

        const choices = pugs.slice(0, 25).map(pug => {
            const date = new Date(pug.scheduled_time);
            const month = date.toLocaleString('en-US', {month: 'short', timeZone: 'UTC'});
            const day = date.getUTCDate();
            const hours = date.getUTCHours().toString().padStart(2, '0');
            const minutes = date.getUTCMinutes().toString().padStart(2, '0');

            let name = `${month} ${day}, ${hours}:${minutes} UTC`;

            const description = pug.discord_event_id ? 'PUG Match' : 'PUG Match';
            name += ` - ${description} (ID: ${pug.pug_id})`;

            if (name.length > 100) {
                name = name.substring(0, 97) + '...';
            }

            return {
                name: name,
                value: pug.pug_id,
            };
        });

        await interaction.respond(choices);
    } catch (error) {
        console.error('Autocomplete error:', error);
        await interaction.respond([]);
    }
}
