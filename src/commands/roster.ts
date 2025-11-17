import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig} from '../database/config';
import {getPlayer} from '../database/players';

export const data = new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Check if the main voice channel has enough players for a match');

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const config = getGuildConfig(db, interaction.guildId);

    if (!config || !config.main_vc_id) {
        await interaction.reply({
            content: 'Main voice channel not configured. Use `/setup mainvc` to set it up.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    try {
        const channel = await interaction.guild?.channels.fetch(config.main_vc_id);

        if (!channel || !channel.isVoiceBased()) {
            await interaction.reply({
                content: 'Could not find the main voice channel. Please reconfigure with `/setup mainvc`.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const members = channel.members;

        if (members.size === 0) {
            await interaction.reply({
                content: 'No one is in the main voice channel.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const unregistered: string[] = [];
        const registered: { username: string; role: string }[] = [];
        let tanks = 0;
        let dps = 0;
        let supports = 0;

        members.forEach(member => {
            const player = getPlayer(db, member.id);

            if (!player) {
                unregistered.push(member.user.username);
            } else {
                registered.push({
                    username: member.user.username,
                    role: player.role,
                });

                switch (player.role) {
                    case 'tank':
                        tanks++;
                        break;
                    case 'dps':
                        dps++;
                        break;
                    case 'support':
                        supports++;
                        break;
                }
            }
        });

        const hasEnoughPlayers = tanks >= 2 && dps >= 4 && supports >= 4;
        const totalRegistered = registered.length;

        let response = `**Roster Check - ${channel.name}**\n\n`;
        response += `**Players in VC:** ${members.size}\n`;
        response += `**Registered:** ${totalRegistered}\n\n`;

        if (unregistered.length > 0) {
            response += `**[WARNING] Unregistered Players (${unregistered.length}):**\n`;
            response += unregistered.map(u => `- ${u}`).join('\n');
            response += '\n\n';
        }

        response += `**Role Distribution:**\n`;
        response += `Tanks: ${tanks}/2 ${tanks >= 2 ? '[OK]' : '[NEED MORE]'}\n`;
        response += `DPS: ${dps}/4 ${dps >= 4 ? '[OK]' : '[NEED MORE]'}\n`;
        response += `Supports: ${supports}/4 ${supports >= 4 ? '[OK]' : '[NEED MORE]'}\n\n`;

        if (hasEnoughPlayers && unregistered.length === 0) {
            response += `[OK] **Ready to start a match!**`;
        } else if (hasEnoughPlayers && unregistered.length > 0) {
            response += `[WARNING] **Enough registered players, but some players need to register first.**`;
        } else {
            response += `[ERROR] **Not enough players for a match.**`;
        }

        await interaction.reply({
            content: response,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        console.error('Roster check error:', error);
        await interaction.reply({
            content: 'Failed to check roster. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
