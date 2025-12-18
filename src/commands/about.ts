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
        .setTitle('Overwatch 2 PUG Bot')
        .setDescription('A dedicated bot for organizing and balancing Overwatch 2 Pick-Up Games.')
        .addFields(
            {
                name: 'Version',
                value: 'v1.0.4',
                inline: true
            },
            {
                name: 'Core Capabilities',
                value: '• **Team Balancing:** Uses TrueSkill ratings and priority-weighted optimization to create fair matches.\n• **Match Management:** Handles the entire match lifecycle from lobby creation to result tracking.\n• **Leaderboards & Stats:** Tracks player performance (wins, losses, skill rating) using TrueSkill system.\n• **Scheduling:** Integrated event scheduling with automated Discord event creation and reminders.\n• **Interactive Setup:** Easy-to-use wizard for server configuration with visual dropdowns.',
                inline: false
            },
            {
                name: 'Matchmaking Engine',
                value: 'Our **V2 Optimization System** uses:\n• **Priority-Weighted Selection:** Favors players who haven\'t played recently\n• **Adaptive Skill Bands:** Dynamically adjusts player pool based on TrueSkill ratings (μ)\n• **Combinatorial Optimization:** Evaluates 1,350+ team combinations to find optimal balance\n• **Smart Cost Function:** 80% priority weight, 20% fairness weight\n• **Role Composition:** Maintains 1-2-2 role lock (1 Tank, 2 DPS, 2 Support per team)',
                inline: false
            },
             {
                name: 'Key Commands',
                value: '`/register` - Sign up to play\n`/update` - Update your profile\n`/setup` - Configure bot settings\n`/makepug` - Create and manage matches\n`/leaderboard` - View top players\n`/schedulepug` - Plan future events\n`/help` - Detailed command usage',
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

