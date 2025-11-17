import {Client, GatewayIntentBits} from 'discord.js';
import dotenv from 'dotenv';
import {initDatabase} from './database/init';
import * as registerCommand from './commands/register';
import * as setupCommand from './commands/setup';
import * as profileCommand from './commands/profile';
import * as updateCommand from './commands/update';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ],
});

const db = initDatabase();

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'register') {
        await registerCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'setup') {
        await setupCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'profile') {
        await profileCommand.execute(interaction, db);
    }
    if (interaction.commandName === 'update') {
        await updateCommand.execute(interaction, db);
    }
});

client.login(process.env.DISCORD_TOKEN);