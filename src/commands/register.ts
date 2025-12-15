import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {isPlayerRegistered} from '../database/players';
import {registrationState} from '../wizard/RegistrationState';
import {buildBattlenetEmbed, buildBattlenetButtons} from '../wizard/registrationUI';

export const data = new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register for PUG matches using an interactive wizard');

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const userId = interaction.user.id;

    // Check if user is already registered
    if (isPlayerRegistered(db, userId)) {
        await interaction.reply({
            content: 'You are already registered! Use `/update` to change your info.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Check if user already has an active registration session
    const existingSession = registrationState.getSession(userId);
    if (existingSession) {
        await interaction.reply({
            content: 'You already have an active registration in progress. Please complete or cancel it first.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Create new registration session
    const session = registrationState.createSession(userId, interaction.channelId);

    // Start cleanup timer if not already running
    registrationState.startCleanupTimer();

    // Build and send initial wizard UI (Step 1: Battle.net ID)
    const embed = buildBattlenetEmbed(session);
    const buttons = buildBattlenetButtons();

    await interaction.reply({
        embeds: [embed],
        components: buttons,
        flags: MessageFlags.Ephemeral,
    });

    // Store message ID for potential updates
    const message = await interaction.fetchReply();
    registrationState.updateSession(userId, {messageId: message.id});
}