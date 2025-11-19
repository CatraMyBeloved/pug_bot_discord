import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {isPlayerRegistered, registerPlayer} from '../database/players';

export const data = new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register for PUG matches')
    .addStringOption(option =>
        option
            .setName('battlenet')
            .setDescription('Your BattleNet ID (e.g., Player#1234)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('roles')
            .setDescription('Roles you can play (select multiple, separated by commas: tank,dps,support)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('rank')
            .setDescription('Your current competitive rank')
            .setRequired(true)
            .addChoices(
                {name: 'Bronze', value: 'bronze'},
                {name: 'Silver', value: 'silver'},
                {name: 'Gold', value: 'gold'},
                {name: 'Platinum', value: 'platinum'},
                {name: 'Diamond', value: 'diamond'},
                {name: 'Master', value: 'master'},
                {name: 'Grandmaster', value: 'grandmaster'},
            )
    );

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const discordUserId = interaction.user.id;
    const battlenet = interaction.options.getString('battlenet', true);
    const rolesInput = interaction.options.getString('roles', true);
    const rank = interaction.options.getString('rank', true);

    if (isPlayerRegistered(db, discordUserId)) {
        await interaction.reply({
            content: 'You are already registered! Use `/update` to change your info.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const validRoles = ['tank', 'dps', 'support'];
    const roles = rolesInput
        .toLowerCase()
        .split(',')
        .map(r => r.trim())
        .filter(r => validRoles.includes(r));

    const uniqueRoles = [...new Set(roles)];

    if (uniqueRoles.length === 0) {
        await interaction.reply({
            content: 'Invalid roles! Please use: tank, dps, or support (separated by commas).\nExample: `tank,dps` or `support` or `tank,dps,support`',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    try {
        registerPlayer(db, discordUserId, battlenet, uniqueRoles, rank);

        await interaction.reply({
            content: `Registered successfully!

**BattleNet:** ${battlenet}
**Roles:** ${uniqueRoles.join(', ')}
**Rank:** ${rank}`,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('Registration error:', error);
        await interaction.reply({
            content: 'Registration failed. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}