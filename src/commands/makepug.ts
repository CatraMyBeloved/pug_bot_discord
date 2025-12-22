import {ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder, VoiceChannel,} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig, getPugLeaderRoles, GuildConfig} from '../database/config';
import {cancelMatch, createMatch, getCurrentMatch, getMatchParticipants, startMatch,} from '../database/matches';
import {hasMatchPermission} from '../utils/permissions';
import {createMatchTeams} from '../utils/matchmaking';
import {InsufficientPlayersError, InsufficientRoleCompositionError,} from '../utils/algorithms/prioritySelection';

export const data = new SlashCommandBuilder()
    .setName('makepug')
    .setDescription('Create and manage PUG matches')
    .addSubcommand((subcommand) =>
        subcommand
            .setName('create')
            .setDescription(
                'Create a new match with automatic player selection'
            )
    )
    .addSubcommand((subcommand) =>
        subcommand.setName('start').setDescription('Start the prepared match')
    )
    .addSubcommand((subcommand) =>
        subcommand.setName('cancel').setDescription('Cancel the current match')
    );

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const member = interaction.member as GuildMember;
    const config = getGuildConfig(db, interaction.guildId);
    const pugLeaderRoles = getPugLeaderRoles(db, interaction.guildId);

    if (!hasMatchPermission(member, config, pugLeaderRoles)) {
        await interaction.reply({
            content:
                "You don't have permission to manage matches. Ask an admin to configure PUG Leader roles using `/setup` wizard.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
        switch (subcommand) {
            case 'create':
                await handleCreate(interaction, db, config);
                break;
            case 'start':
                await handleStart(interaction, db, config);
                break;
            case 'cancel':
                await handleCancel(interaction, db);
                break;
        }
    } catch (error) {
        console.error('Makepug error:', error);
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleCreate(
    interaction: ChatInputCommandInteraction,
    db: Database.Database,
    config: GuildConfig | undefined
) {
    const existingMatch = getCurrentMatch(db, interaction.guildId!);
    if (existingMatch) {
        await interaction.reply({
            content: `A match is already ${existingMatch.state}. Use \`/makepug cancel\` first or \`/makepug start\` to begin.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!config?.main_vc_id) {
        await interaction.reply({
            content:
                'Main voice channel not configured. Use `/setup` wizard to configure voice channels.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const mainVC = (await interaction.guild!.channels.fetch(
        config.main_vc_id
    )) as VoiceChannel;
    if (!mainVC) {
        await interaction.reply({
            content: 'Main voice channel not found.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const userIdsInVC = Array.from(mainVC.members.keys());

    try {
        const teams = createMatchTeams(userIdsInVC, db, interaction.guildId!);

        const participants = [
            ...teams.team1.map((p) => ({
                userId: p.userId,
                team: 1,
                assignedRole: p.assignedRole,
            })),
            ...teams.team2.map((p) => ({
                userId: p.userId,
                team: 2,
                assignedRole: p.assignedRole,
            })),
        ];

        createMatch(db, config.main_vc_id, participants);

        const formatTeam = (players: typeof teams.team1) => {
            const grouped = {
                tank: players.filter((p) => p.assignedRole === 'tank'),
                dps: players.filter((p) => p.assignedRole === 'dps'),
                support: players.filter((p) => p.assignedRole === 'support'),
            };

            return `**Tank:** ${grouped.tank.map((p) => `<@${p.userId}> (${p.battlenetId})`).join(', ')}
**DPS:** ${grouped.dps.map((p) => `<@${p.userId}> (${p.battlenetId})`).join(', ')}
**Support:** ${grouped.support.map((p) => `<@${p.userId}> (${p.battlenetId})`).join(', ')}`;
        };

        await interaction.reply({
            content: `Match Prepared! Use \`/makepug start\` to begin.

**Team 1:**
${formatTeam(teams.team1)}

**Team 2:**
${formatTeam(teams.team2)}

Copy BattleTags to create in-game lobby.`,
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        if (error instanceof InsufficientPlayersError) {
            await interaction.reply({
                content: error.message,
                flags: MessageFlags.Ephemeral,
            });
        } else if (error instanceof InsufficientRoleCompositionError) {
            await interaction.reply({
                content: error.message,
                flags: MessageFlags.Ephemeral,
            });
        } else {
            throw error;
        }
    }
}

async function handleStart(
    interaction: ChatInputCommandInteraction,
    db: Database.Database,
    config: GuildConfig | undefined
) {
    const match = getCurrentMatch(db, interaction.guildId!);

    if (!match) {
        await interaction.reply({
            content: 'No prepared match found. Use `/makepug create` first.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (match.state === 'active') {
        await interaction.reply({
            content: 'Match has already been started.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const participants = getMatchParticipants(db, match.match_id);

    const mainVC = match.voice_channel_id
        ? ((await interaction.guild!.channels.fetch(
            match.voice_channel_id
        )) as VoiceChannel)
        : null;

    const missingPlayers: string[] = [];
    if (mainVC) {
        const presentUserIds = new Set(Array.from(mainVC.members.keys()));
        for (const participant of participants) {
            if (!presentUserIds.has(participant.discord_user_id)) {
                missingPlayers.push(`<@${participant.discord_user_id}>`);
            }
        }
    }

    let moveMessage = '';
    if (config?.auto_move === 1 && config.team1_vc_id && config.team2_vc_id) {
        const team1VC = (await interaction.guild!.channels.fetch(
            config.team1_vc_id
        )) as VoiceChannel;
        const team2VC = (await interaction.guild!.channels.fetch(
            config.team2_vc_id
        )) as VoiceChannel;

        if (team1VC && team2VC) {
            for (let i = 0; i < participants.length; i++) {
                const participant = participants[i];
                try {
                    const member = await interaction.guild!.members.fetch(
                        participant.discord_user_id
                    );
                    if (member.voice.channel) {
                        const targetVC =
                            participant.team === 1 ? team1VC : team2VC;
                        await member.voice.setChannel(targetVC);
                    }
                } catch (error) {
                    console.error(
                        `Failed to move ${participant.discord_user_id}:`,
                        error
                    );
                }

                // Add delay between moves to prevent rate limiting (except after last move)
                if (i < participants.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            moveMessage = '\n\nPlayers have been moved to their team voice channels.';
        }
    }

    startMatch(db, match.match_id);

    let warningMessage = '';
    if (missingPlayers.length > 0) {
        warningMessage = `\n\n⚠️ Warning: The following players have left the voice channel: ${missingPlayers.join(', ')}`;
    }

    await interaction.reply({
        content: `Match Started!${moveMessage}${warningMessage}\n\nGood luck and have fun!`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleCancel(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const match = getCurrentMatch(db, interaction.guildId!);

    if (!match) {
        await interaction.reply({
            content: 'No match to cancel.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    cancelMatch(db, match.match_id);

    await interaction.reply({
        content: 'Match cancelled.',
        flags: MessageFlags.Ephemeral,
    });
}
