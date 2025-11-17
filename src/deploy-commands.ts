import {REST, Routes} from 'discord.js';
import dotenv from 'dotenv';
import {data as registerCommand} from './commands/register';
import {data as setupCommand} from './commands/setup';
import {data as profileCommand} from './commands/profile';
import {data as updateCommand} from './commands/update';

dotenv.config();

const commands = [
    registerCommand.toJSON(),
    setupCommand.toJSON(),
    profileCommand.toJSON(),
    updateCommand.toJSON(),
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