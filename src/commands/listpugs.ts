import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {getUpcomingPugs} from '../database/scheduled_pugs';

export const data = new SlashCommandBuilder()
    .setName('listpugs')
    .setDescription('View upcoming scheduled PUGs');

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

    try {
        const pugs = getUpcomingPugs(db, interaction.guildId);

        if (pugs.length === 0) {
            await interaction.reply({
                content: 'No upcoming scheduled PUGs.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        let response = `**Upcoming Scheduled PUGs**\n\n`;

        for (const pug of pugs) {
            const timestamp = Math.floor(new Date(pug.scheduled_time).getTime() / 1000);
            const creator = await interaction.client.users.fetch(pug.created_by).catch(() => null);
            const creatorName = creator ? creator.username : 'Unknown';

            response += `**ID:** ${pug.pug_id}\n`;
            response += `**Time:** <t:${timestamp}:F> (<t:${timestamp}:R>)\n`;
            response += `**Created by:** ${creatorName}\n`;
            response += `**State:** ${pug.state}\n`;

            if (pug.discord_event_id) {
                try {
                    const event = await interaction.guild?.scheduledEvents.fetch(pug.discord_event_id);
                    if (event) {
                        response += `**Event:** ${event.url}\n`;
                    }
                } catch (error) {
                }
            }

            response += `\n`;
        }

        await interaction.reply({
            content: response,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('List schedule error:', error);
        await interaction.reply({
            content: 'Failed to list scheduled PUGs. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
