import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';

export const data = new SlashCommandBuilder()
    .setName('about')
    .setDescription('Show information about the PUG Bot');

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const embed = new EmbedBuilder()
        .setTitle('🤖 Overwatch 2 PUG Bot')
        .setDescription('A dedicated bot for organizing and balancing Overwatch 2 Pick-Up Games.')
        .addFields(
            {
                name: 'Version',
                value: 'v1.0.0',
                inline: true
            },
            {
                name: 'Core Capabilities',
                value: '• **Team Balancing:**  Uses competitive rank and role preference to create fair matches.\n• **Match Management:** Handles the entire match lifecycle from lobby creation to result tracking.\n• **Leaderboards & Stats:** tracks player performance (wins, losses, SR) using TrueSkill.\n• **Scheduling:** Integrated event scheduling with automated Discord event creation and reminders.\n• **Interactive Setup:**  Easy-to-use wizard for server configuration.',
                inline: false
            },
            {
                name: 'Matchmaking Engine',
                value: 'Our system uses a **Priority Selection System** to pick players based on role scarcity and time since last match. It then applies a **Greedy Balancing Algorithm** to minimize the SR difference between teams, ensuring a 2-2-1 role lock (1 Tank, 2 DPS, 2 Support).',
                inline: false
            },
             {
                name: 'Key Commands',
                value: '`/register` - Sign up to play\n`/makepug` - Create and manage matches\n`/leaderboard` - View top players\n`/schedulepug` - Plan future events\n`/help` - Detailed command usage',
                inline: false
            }
        )
        .setColor(0x0099FF)
        .setFooter({ text: 'Developed for the PUG Community' })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
    });
}

