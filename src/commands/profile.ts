import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {getPlayerStats} from '../database/players';

export const data = new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your player profile and stats')
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('The user to view (leave empty for yourself)')
            .setRequired(false)
    );

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const discordUserId = targetUser.id;

    const stats = getPlayerStats(db, discordUserId, 10);

    if (!stats) {
        const message = targetUser.id === interaction.user.id
            ? 'You are not registered! Use `/register` to get started.'
            : `${targetUser.username} is not registered.`;

        await interaction.reply({
            content: message,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Build embed
    const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Profile`)
        .setColor(getColorByWinRate(stats.winRate))
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            {
                name: 'BattleNet ID',
                value: stats.player.battlenet_id,
                inline: true
            },
            {
                name: 'Current Rank',
                value: capitalizeRank(stats.player.rank),
                inline: true
            },
            {
                name: 'Registered Roles',
                value: stats.player.roles && stats.player.roles.length > 0
                    ? stats.player.roles.map(r => capitalizeRank(r)).join(', ')
                    : 'None',
                inline: true
            }
        )
        .addFields(
            {
                name: 'Games Played',
                value: stats.totalGames.toString(),
                inline: true
            },
            {
                name: 'Win/Loss',
                value: `${stats.player.wins}W - ${stats.player.losses}L`,
                inline: true
            },
            {
                name: 'Win Rate',
                value: `${stats.winRate.toFixed(1)}%`,
                inline: true
            }
        );

    // Role breakdown (only show if player has played games)
    if (stats.totalGames > 0) {
        const roleBreakdown = [
            `${getRoleEmoji('tank')} Tank: ${stats.roleStats.tank} games`,
            `${getRoleEmoji('dps')} DPS: ${stats.roleStats.dps} games`,
            `${getRoleEmoji('support')} Support: ${stats.roleStats.support} games`
        ].join('\n');

        embed.addFields({
            name: 'Role Breakdown',
            value: roleBreakdown,
            inline: false
        });
    }

    // Recent matches (only show if there are any)
    if (stats.recentMatches.length > 0) {
        const matchesText = stats.recentMatches.slice(0, 5).map(match => {
            const result = match.isDraw ? '➖ Draw' : match.wonMatch ? '✅ Win' : '❌ Loss';
            const roleEmoji = getRoleEmoji(match.assignedRole);
            const timestamp = `<t:${Math.floor(new Date(match.completedAt).getTime() / 1000)}:R>`;
            return `${result} ${roleEmoji} ${capitalizeRank(match.assignedRole)} - ${timestamp}`;
        }).join('\n');

        embed.addFields({
            name: 'Recent Matches (Last 5)',
            value: matchesText,
            inline: false
        });
    }

    embed.setFooter({
        text: `Registered ${new Date(stats.player.registered_at).toLocaleDateString()}`
    });

    embed.setTimestamp();

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
    });
}

// Helper functions
function getColorByWinRate(winRate: number): number {
    if (winRate >= 60) return 0x00FF00; // Green
    if (winRate >= 50) return 0xFFAA00; // Yellow
    if (winRate >= 40) return 0xFF6600; // Orange
    return 0xFF0000; // Red
}

function capitalizeRank(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getRoleEmoji(role: string): string {
    switch (role) {
        case 'tank': return '🛡️';
        case 'dps': return '⚔️';
        case 'support': return '💚';
        default: return '❓';
    }
}
