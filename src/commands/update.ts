import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {getPlayer} from '../database/players';
import {updateState} from '../wizard/UpdateState';
import {buildUpdateBattlenetEmbed, buildUpdateBattlenetButtons} from '../wizard/updateUI';
import {Role, Rank} from '../types/matchmaking';

export const data = new SlashCommandBuilder()
    .setName('update')
    .setDescription('Update your player information using an interactive wizard');

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const userId = interaction.user.id;

    // Check if user is registered
    const player = getPlayer(db, userId);
    if (!player) {
        await interaction.reply({
            content: 'You are not registered! Use `/register` first.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Check if user already has an active update session
    const existingSession = updateState.getSession(userId);
    if (existingSession) {
        await interaction.reply({
            content: 'You already have an active update in progress. Please complete or cancel it first.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Create new update session with current data
    // Normalize roles to match Role type
    const currentRoles: Role[] = (player.roles || []).map(r => r.toLowerCase() as Role);
    const currentRank: Rank | null = player.rank ? (player.rank.toLowerCase() as Rank) : null;

    const session = updateState.createSession(userId, interaction.channelId, {
        battlenetId: player.battlenet_id,
        selectedRoles: currentRoles,
        selectedRank: currentRank
    });

    // Start cleanup timer if not already running
    updateState.startCleanupTimer();

    // Build and send initial wizard UI (Step 1: Battle.net ID)
    const embed = buildUpdateBattlenetEmbed(session);
    const buttons = buildUpdateBattlenetButtons();

    await interaction.reply({
        embeds: [embed],
        components: buttons,
        flags: MessageFlags.Ephemeral,
    });

    // Store message ID for potential updates
    const message = await interaction.fetchReply();
    updateState.updateSession(userId, {messageId: message.id});
}
