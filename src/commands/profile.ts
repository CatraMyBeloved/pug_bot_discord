import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {getPlayer} from '../database/players';

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

    const player = getPlayer(db, discordUserId);

    if (!player) {
        const message = targetUser.id === interaction.user.id
            ? 'You are not registered! Use `/register` to get started.'
            : `${targetUser.username} is not registered.`;

        await interaction.reply({
            content: message,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const totalGames = player.wins + player.losses;
    const winRate = totalGames > 0
        ? ((player.wins / totalGames) * 100).toFixed(1)
        : '0.0';

    const gamesPlayedText = totalGames === 0
        ? 'No games played yet'
        : `${totalGames} game${totalGames !== 1 ? 's' : ''} played`;

    await interaction.reply({
        content: `**Profile: ${targetUser.username}**

**BattleNet:** ${player.battlenet_id}
**Role:** ${player.role.charAt(0).toUpperCase() + player.role.slice(1)}
**Rank:** ${player.rank.charAt(0).toUpperCase() + player.rank.slice(1)}

**Stats:**
${gamesPlayedText}
Wins: ${player.wins}
Losses: ${player.losses}
Win Rate: ${winRate}%

*Registered: <t:${Math.floor(new Date(player.registered_at).getTime() / 1000)}:R>*`,
        flags: MessageFlags.Ephemeral,
    });
}
