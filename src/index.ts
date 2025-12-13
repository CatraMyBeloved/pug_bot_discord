import {Client, GatewayIntentBits} from 'discord.js';
import dotenv from 'dotenv';
import {initDatabase} from './database/init';
import {initializeScheduler} from './services/scheduler';
import * as registerCommand from './commands/register';
import * as setupCommand from './commands/setup-wizard';
import * as setupResetCommand from './commands/setup-reset';
import * as profileCommand from './commands/profile';
import * as updateCommand from './commands/update';
import * as rosterCommand from './commands/roster';
import * as schedulepugCommand from './commands/schedulepug';
import * as listpugsCommand from './commands/listpugs';
import * as cancelpugCommand from './commands/cancelpug';
import * as makepugCommand from './commands/makepug';
import * as matchCommand from './commands/match';
import * as helpCommand from './commands/help';
import * as testCommand from './commands/test';
import {handleCancelpugButton} from './handlers/cancelpugHandlers';
import {handleWizardButton, handleWizardSelectMenu} from './handlers/wizardInteractionHandler';
import {handleSetupResetButton} from './handlers/setupResetHandlers';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildScheduledEvents,
    ],
});

const db = initDatabase();

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user?.tag}`);
    initializeScheduler(client, db);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'cancelpug') {
            await cancelpugCommand.autocomplete(interaction, db);
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

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'register') {
        await registerCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'setup') {
        await setupCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'setup-reset') {
        await setupResetCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'profile') {
        await profileCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'update') {
        await updateCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'roster') {
        await rosterCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'schedulepug') {
        await schedulepugCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'listpugs') {
        await listpugsCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'cancelpug') {
        await cancelpugCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'makepug') {
        await makepugCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'match') {
        await matchCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'help') {
        await helpCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'test') {
        await testCommand.execute(interaction, db);
    }
});

client.login(process.env.DISCORD_TOKEN);