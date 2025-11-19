import {ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig} from '../database/config';
import {completeMatch, getCurrentMatch} from '../database/matches';
import {hasMatchPermission} from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('match')
    .setDescription('Manage active matches')
    .addSubcommand((subcommand) =>
        subcommand
            .setName('complete')
            .setDescription('Mark the current active match as complete')
            .addStringOption((option) =>
                option
                    .setName('winning_team')
                    .setDescription('The winning team')
                    .setRequired(true)
                    .addChoices(
                        {name: 'Team 1', value: '1'},
                        {name: 'Team 2', value: '2'},
                        {name: 'Draw', value: 'draw'}
                    )
            )
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

    if (!hasMatchPermission(member, config)) {
        await interaction.reply({
            content: "You don't have permission to manage matches.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
        if (subcommand === 'complete') {
            await handleComplete(interaction, db);
        }
    } catch (error) {
        console.error('Match error:', error);
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleComplete(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const match = getCurrentMatch(db, interaction.guildId!);

    if (!match) {
        await interaction.reply({
            content: 'No active match found.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (match.state !== 'active') {
        await interaction.reply({
            content: `Match is not active. Current state: ${match.state}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const winningTeamStr = interaction.options.getString('winning_team', true);
    const winningTeam =
        winningTeamStr === 'draw' ? null : parseInt(winningTeamStr);

    completeMatch(db, match.match_id, winningTeam);

    const winnerText =
        winningTeam === null
            ? 'Draw'
            : winningTeam === 1
                ? 'Team 1'
                : 'Team 2';

    await interaction.reply({
        content: `Match completed!\nWinning Team: ${winnerText}\n\n*Note: Win/loss tracking will be added in Phase 2.*`,
        flags: MessageFlags.Ephemeral,
    });
}
