import {REST, Routes} from 'discord.js';
import dotenv from 'dotenv';
import {data as registerCommand} from './commands/register';
import {data as setupCommand} from './commands/setup';
import {data as profileCommand} from './commands/profile';
import {data as updateCommand} from './commands/update';
import {data as rosterCommand} from './commands/roster';
import {data as schedulepugCommand} from './commands/schedulepug';
import {data as listpugsCommand} from './commands/listpugs';
import {data as cancelpugCommand} from './commands/cancelpug';
import {data as makepugCommand} from './commands/makepug';
import {data as matchCommand} from './commands/match';

dotenv.config();

const commands = [
    registerCommand.toJSON(),
    setupCommand.toJSON(),
    profileCommand.toJSON(),
    updateCommand.toJSON(),
    rosterCommand.toJSON(),
    schedulepugCommand.toJSON(),
    listpugsCommand.toJSON(),
    cancelpugCommand.toJSON(),
    makepugCommand.toJSON(),
    matchCommand.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('Registering slash commands...');

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID!,
                process.env.GUILD_ID!
            ),
            {body: commands}
        );

        console.log('Commands registered!');
    } catch (error) {
        console.error(error);
    }
})();