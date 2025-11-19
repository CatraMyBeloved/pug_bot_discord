import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {isPlayerRegistered, updatePlayer} from '../database/players';

export const data = new SlashCommandBuilder()
    .setName('update')
    .setDescription('Update your player information')
    .addStringOption(option =>
        option
            .setName('battlenet')
            .setDescription('Your BattleNet ID (e.g., Player#1234)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('roles')
            .setDescription('Roles you can play (separated by commas: tank,dps,support)')
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('rank')
            .setDescription('Your current competitive rank')
            .setRequired(false)
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

    if (!isPlayerRegistered(db, discordUserId)) {
        await interaction.reply({
            content: 'You are not registered! Use `/register` first.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const battlenet = interaction.options.getString('battlenet');
    const rolesInput = interaction.options.getString('roles');
    const rank = interaction.options.getString('rank');

    if (!battlenet && !rolesInput && !rank) {
        await interaction.reply({
            content: 'Please provide at least one field to update.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    let roles: string[] | undefined = undefined;
    if (rolesInput) {
        const validRoles = ['tank', 'dps', 'support'];
        const parsedRoles = rolesInput
            .toLowerCase()
            .split(',')
            .map(r => r.trim())
            .filter(r => validRoles.includes(r));

        roles = [...new Set(parsedRoles)];

        if (roles.length === 0) {
            await interaction.reply({
                content: 'Invalid roles! Please use: tank, dps, or support (separated by commas).\nExample: `tank,dps` or `support` or `tank,dps,support`',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
    }

    try {
        updatePlayer(db, discordUserId, battlenet ?? undefined, roles, rank ?? undefined);

        const updates: string[] = [];
        if (battlenet) updates.push(`**BattleNet:** ${battlenet}`);
        if (roles) updates.push(`**Roles:** ${roles.join(', ')}`);
        if (rank) updates.push(`**Rank:** ${rank}`);

        await interaction.reply({
            content: `Profile updated successfully!

${updates.join('\n')}`,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('Update error:', error);
        await interaction.reply({
            content: 'Update failed. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
