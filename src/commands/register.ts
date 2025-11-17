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
            .setName('role')
            .setDescription('Your preferred role')
            .setRequired(true)
            .addChoices(
                {name: 'Tank', value: 'tank'},
                {name: 'DPS', value: 'dps'},
                {name: 'Support', value: 'support'},
            )
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
                {name: 'Platin', value: 'platin'},
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
    const role = interaction.options.getString('role', true);
    const rank = interaction.options.getString('rank', true);

    if (isPlayerRegistered(db, discordUserId)) {
        await interaction.reply({
            content: 'You are already registered! Use `/update` to change your info.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Save to database
    try {
        registerPlayer(db, discordUserId, battlenet, role, rank);

        await interaction.reply({
            content: `Registered successfully!
      
**BattleNet:** ${battlenet}
**Role:** ${role}
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