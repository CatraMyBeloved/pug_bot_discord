import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import {initDatabase} from './database/init';
import {initializeScheduler} from './services/scheduler';
import * as registerCommand from './commands/register';
import * as setupCommand from './commands/setup-wizard';
import * as setupResetCommand from './commands/setup-reset';
import * as profileCommand from './commands/profile';
import * as leaderboardCommand from './commands/leaderboard';
import * as updateCommand from './commands/update';
import * as rosterCommand from './commands/roster';
import * as schedulepugCommand from './commands/schedulepug';
import * as listpugsCommand from './commands/listpugs';
import * as cancelpugCommand from './commands/cancelpug';
import * as makepugCommand from './commands/makepug';
import * as matchCommand from './commands/match';
import * as helpCommand from './commands/help';
import * as testCommand from './commands/test';
import * as aboutCommand from './commands/about';
import {handleCancelpugButton} from './handlers/cancelpugHandlers';
import {handleWizardButton, handleWizardSelectMenu} from './handlers/wizardInteractionHandler';
import {handleSetupResetButton} from './handlers/setupResetHandlers';
import {handleRegistrationButton, handleRegistrationModal} from './handlers/registrationInteractionHandler';
import {handleUpdateButton, handleUpdateModal} from './handlers/updateInteractionHandler';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildScheduledEvents,
    ],
});

const db = initDatabase();

interface BotCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
    execute: (interaction: ChatInputCommandInteraction, db: Database.Database) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction, db: Database.Database) => Promise<void>;
}

// Command registry map
const commands = new Map<string, BotCommand>([
    ['register', registerCommand],
    ['setup', setupCommand],
    ['setup-reset', setupResetCommand],
    ['profile', profileCommand],
    ['leaderboard', leaderboardCommand],
    ['update', updateCommand],
    ['roster', rosterCommand],
    ['schedulepug', schedulepugCommand],
    ['listpugs', listpugsCommand],
    ['cancelpug', cancelpugCommand],
    ['makepug', makepugCommand],
    ['match', matchCommand],
    ['help', helpCommand],
    ['test', testCommand],
    ['about', aboutCommand],
]);

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user?.tag}`);
    initializeScheduler(client, db);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        const command = commands.get(interaction.commandName);
        if (command?.autocomplete) {
            await command.autocomplete(interaction, db);
        }
        return;
    }

    if (interaction.isButton()) {
        // Handle button interactions
        const customId = interaction.customId;

        // Route to appropriate handler based on button ID prefix
        if (customId.startsWith('confirm_cancel_') || customId.startsWith('decline_cancel_')) {
            await handleCancelpugButton(interaction, db);
            return;
        }

        if (customId.startsWith('confirm_reset_') || customId.startsWith('cancel_reset_')) {
            await handleSetupResetButton(interaction, db);
            return;
        }

        if (customId.startsWith('wizard:')) {
            await handleWizardButton(interaction, db);
            return;
        }

        if (customId.startsWith('register:')) {
            await handleRegistrationButton(interaction, db);
            return;
        }

        if (customId.startsWith('update:')) {
            await handleUpdateButton(interaction, db);
            return;
        }

        // Unknown button
        await interaction.reply({
            content: 'Unknown button interaction.',
            flags: 64
        });
        return;
    }

    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
        // Handle select menu interactions
        const customId = interaction.customId;

        if (customId.startsWith('wizard:select:')) {
            await handleWizardSelectMenu(interaction, db);
            return;
        }

        // Unknown select menu
        await interaction.reply({
            content: 'Unknown select menu interaction.',
            flags: 64
        });
        return;
    }

    if (interaction.isModalSubmit()) {
        // Handle modal submissions
        const customId = interaction.customId;

        if (customId.startsWith('register:')) {
            await handleRegistrationModal(interaction, db);
            return;
        }

        if (customId.startsWith('update:')) {
            await handleUpdateModal(interaction, db);
            return;
        }

        // Unknown modal
        await interaction.reply({
            content: 'Unknown modal interaction.',
            flags: 64
        });
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (command) {
        await command.execute(interaction, db);
    } else {
        console.warn(`Unknown command: ${interaction.commandName}`);
    }
});

client.login(process.env.DISCORD_TOKEN);