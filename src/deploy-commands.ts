import {REST, Routes} from 'discord.js';
import dotenv from 'dotenv';
import {data as registerCommand} from './commands/register';
import {data as setupCommand} from './commands/setup-wizard';
import {data as setupResetCommand} from './commands/setup-reset';
import {data as profileCommand} from './commands/profile';
import {data as updateCommand} from './commands/update';
import {data as rosterCommand} from './commands/roster';
import {data as schedulepugCommand} from './commands/schedulepug';
import {data as listpugsCommand} from './commands/listpugs';
import {data as cancelpugCommand} from './commands/cancelpug';
import {data as makepugCommand} from './commands/makepug';
import {data as matchCommand} from './commands/match';
import {data as helpCommand} from './commands/help';
import {data as testCommand} from './commands/test';

dotenv.config();

const commands = [
    registerCommand.toJSON(),
    setupCommand.toJSON(),
    setupResetCommand.toJSON(),
    profileCommand.toJSON(),
    updateCommand.toJSON(),
    rosterCommand.toJSON(),
    schedulepugCommand.toJSON(),
    listpugsCommand.toJSON(),
    cancelpugCommand.toJSON(),
    makepugCommand.toJSON(),
    matchCommand.toJSON(),
    helpCommand.toJSON(),
    testCommand.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        const guildId = process.env.GUILD_ID;

        // Clear guild-specific commands if GUILD_ID is set
        if (guildId) {
            console.log(`Clearing guild-specific commands for guild ${guildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId),
                {body: []}
            );
            console.log('Guild-specific commands cleared successfully!');
        }

        // Deploy global commands
        console.log('Registering slash commands globally...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            {body: commands}
        );

        console.log('Global commands registered successfully!');
        console.log('Note: Global commands may take up to 1 hour to appear in all guilds.');
    } catch (error) {
        console.error(error);
    }
})();