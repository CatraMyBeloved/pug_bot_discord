import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {getLeaderboard} from '../database/players';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top players ranked by performance')
    .addIntegerOption(option =>
        option
            .setName('limit')
            .setDescription('Number of players to show (default: 10, max: 25)')
            .setMinValue(5)
            .setMaxValue(25)
            .setRequired(false)
    )
    .addIntegerOption(option =>
        option
            .setName('mingames')
            .setDescription('Minimum games required (default: 3)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
    );

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const limit = interaction.options.getInteger('limit') ?? 10;
    const minGames = interaction.options.getInteger('mingames') ?? 3;

    const leaderboard = getLeaderboard(db, limit, minGames);

    if (leaderboard.length === 0) {
        await interaction.reply({
            content: `No players found with at least ${minGames} game${minGames !== 1 ? 's' : ''} played.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🏆 Player Leaderboard')
        .setDescription(`Top ${leaderboard.length} players with ${minGames}+ games played\n*Ranked by Skill Rating (SR)*`)
        .setColor(0xFFD700) // Gold color
        .setTimestamp();

    // Build leaderboard text
    const leaderboardText = leaderboard.map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const winRateDisplay = entry.winRate.toFixed(1);

        return `${medal} **${entry.battlenetId}**\n` +
            `   **${entry.sr} SR** • ${entry.wins}W-${entry.losses}L (${winRateDisplay}%) • ` +
            `${entry.totalGames} games`;
    }).join('\n\n');

    // Discord embeds have a 4096 character limit for description
    // Split into fields if needed
    if (leaderboardText.length <= 4096) {
        embed.setDescription(
            embed.data.description + '\n\n' + leaderboardText
        );
    } else {
        // Split into multiple fields
        const midpoint = Math.ceil(leaderboard.length / 2);
        const topHalf = leaderboard.slice(0, midpoint);
        const bottomHalf = leaderboard.slice(midpoint);

        embed.addFields(
            {
                name: `Rank 1-${midpoint}`,
                value: topHalf.map((entry, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    return `${medal} ${entry.battlenetId} - ${entry.winRate.toFixed(1)}% (${entry.totalGames}g)`;
                }).join('\n'),
                inline: false
            },
            {
                name: `Rank ${midpoint + 1}-${leaderboard.length}`,
                value: bottomHalf.map((entry, index) => {
                    const rank = midpoint + index + 1;
                    return `${rank}. ${entry.battlenetId} - ${entry.winRate.toFixed(1)}% (${entry.totalGames}g)`;
                }).join('\n'),
                inline: false
            }
        );
    }

    embed.setFooter({
        text: `Use /profile to view detailed stats`
    });

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
    });
}
