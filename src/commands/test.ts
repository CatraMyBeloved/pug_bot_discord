import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    VoiceChannel,
} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig, getPugLeaderRoles} from '../database/config';
import {hasMatchPermission} from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test bot voice channel functionalities (Admin or PUG Leader)')
    .addSubcommand((subcommand) =>
        subcommand
            .setName('all')
            .setDescription('Run all tests including voice channel move cycle')
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('read')
            .setDescription('Test reading voice channel members only')
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('move')
            .setDescription('Test moving you through voice channels (main → team1 → team2 → main)')
    );

interface TestResult {
    name: string;
    passed: boolean;
    details: string;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
            content: "You don't have permission to run tests. Requires Administrator or PUG Leader role.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const results: TestResult[] = [];

    try {
        const configResult = testConfig(config);
        results.push(configResult);

        if (!configResult.passed) {
            await sendResults(interaction, results, 'Config not set up');
            return;
        }

        const channelResults = await testFetchChannels(interaction, config);
        results.push(...channelResults);

        const mainVCResult = channelResults.find((r) => r.name === 'Fetch Main VC');
        if (!mainVCResult?.passed || !config?.main_vc_id) {
            await sendResults(interaction, results, 'Cannot fetch main VC');
            return;
        }

        const mainVC = (await interaction.guild.channels.fetch(config.main_vc_id)) as VoiceChannel;
        const readResult = testReadMembers(mainVC);
        results.push(readResult);

        const fetchMemberResult = await testFetchMember(interaction);
        results.push(fetchMemberResult);

        const voiceStateResult = testVoiceState(member);
        results.push(voiceStateResult);

        const permissionResults = await testBotPermissions(interaction, config);
        results.push(...permissionResults);

        if ((subcommand === 'all' || subcommand === 'move') && voiceStateResult.passed) {
            const team1VCResult = channelResults.find((r) => r.name === 'Fetch Team 1 VC');
            const team2VCResult = channelResults.find((r) => r.name === 'Fetch Team 2 VC');

            if (team1VCResult?.passed && team2VCResult?.passed) {
                const moveResults = await testMoveSequence(interaction, config, member);
                results.push(...moveResults);
            } else {
                results.push({
                    name: 'Move Sequence',
                    passed: false,
                    details: 'Skipped: Team VCs not configured or not accessible',
                });
            }
        } else if (subcommand === 'all' || subcommand === 'move') {
            results.push({
                name: 'Move Sequence',
                passed: false,
                details: 'Skipped: You must be in a voice channel to test moving',
            });
        }

        await sendResults(interaction, results, 'Tests completed');
    } catch (error) {
        console.error('Test command error:', error);
        results.push({
            name: 'Unexpected Error',
            passed: false,
            details: error instanceof Error ? error.message : 'Unknown error',
        });
        await sendResults(interaction, results, 'Tests failed with error');
    }
}

function testConfig(config: any): TestResult {
    if (!config) {
        return {
            name: 'Guild Config',
            passed: false,
            details: 'No configuration found. Use `/setup` commands first.',
        };
    }

    const missing: string[] = [];
    if (!config.main_vc_id) missing.push('main_vc');
    if (!config.team1_vc_id) missing.push('team1_vc');
    if (!config.team2_vc_id) missing.push('team2_vc');

    if (missing.length > 0) {
        return {
            name: 'Guild Config',
            passed: missing.length === 0 || !!config.main_vc_id,
            details: missing.length === 0
                ? 'All voice channels configured'
                : `Missing: ${missing.join(', ')}`,
        };
    }

    return {
        name: 'Guild Config',
        passed: true,
        details: 'All voice channels configured',
    };
}

async function testFetchChannels(
    interaction: ChatInputCommandInteraction,
    config: any
): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
        const mainVC = await interaction.guild!.channels.fetch(config.main_vc_id);
        if (mainVC && mainVC.isVoiceBased()) {
            results.push({
                name: 'Fetch Main VC',
                passed: true,
                details: `Found: ${mainVC.name}`,
            });
        } else {
            results.push({
                name: 'Fetch Main VC',
                passed: false,
                details: 'Channel exists but is not a voice channel',
            });
        }
    } catch (error) {
        results.push({
            name: 'Fetch Main VC',
            passed: false,
            details: `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }

    if (config.team1_vc_id) {
        try {
            const team1VC = await interaction.guild!.channels.fetch(config.team1_vc_id);
            if (team1VC && team1VC.isVoiceBased()) {
                results.push({
                    name: 'Fetch Team 1 VC',
                    passed: true,
                    details: `Found: ${team1VC.name}`,
                });
            } else {
                results.push({
                    name: 'Fetch Team 1 VC',
                    passed: false,
                    details: 'Channel exists but is not a voice channel',
                });
            }
        } catch (error) {
            results.push({
                name: 'Fetch Team 1 VC',
                passed: false,
                details: `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    } else {
        results.push({
            name: 'Fetch Team 1 VC',
            passed: false,
            details: 'Not configured',
        });
    }

    if (config.team2_vc_id) {
        try {
            const team2VC = await interaction.guild!.channels.fetch(config.team2_vc_id);
            if (team2VC && team2VC.isVoiceBased()) {
                results.push({
                    name: 'Fetch Team 2 VC',
                    passed: true,
                    details: `Found: ${team2VC.name}`,
                });
            } else {
                results.push({
                    name: 'Fetch Team 2 VC',
                    passed: false,
                    details: 'Channel exists but is not a voice channel',
                });
            }
        } catch (error) {
            results.push({
                name: 'Fetch Team 2 VC',
                passed: false,
                details: `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    } else {
        results.push({
            name: 'Fetch Team 2 VC',
            passed: false,
            details: 'Not configured',
        });
    }

    return results;
}

function testReadMembers(channel: VoiceChannel): TestResult {
    try {
        const members = Array.from(channel.members.keys());
        const memberNames = Array.from(channel.members.values())
            .map((m) => m.displayName)
            .join(', ');

        return {
            name: 'Read VC Members',
            passed: true,
            details: `${members.length} member(s): ${memberNames || 'None'}`,
        };
    } catch (error) {
        return {
            name: 'Read VC Members',
            passed: false,
            details: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

async function testFetchMember(
    interaction: ChatInputCommandInteraction
): Promise<TestResult> {
    try {
        const member = await interaction.guild!.members.fetch(interaction.user.id);
        return {
            name: 'Fetch Guild Member',
            passed: true,
            details: `Fetched: ${member.displayName}`,
        };
    } catch (error) {
        return {
            name: 'Fetch Guild Member',
            passed: false,
            details: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

function testVoiceState(member: GuildMember): TestResult {
    if (member.voice.channel) {
        return {
            name: 'Voice State Check',
            passed: true,
            details: `Currently in: ${member.voice.channel.name}`,
        };
    }

    return {
        name: 'Voice State Check',
        passed: false,
        details: 'Not in a voice channel',
    };
}

async function testBotPermissions(
    interaction: ChatInputCommandInteraction,
    config: any
): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const botMember = interaction.guild!.members.me;

    if (!botMember) {
        results.push({
            name: 'Bot Permissions',
            passed: false,
            details: 'Could not fetch bot member',
        });
        return results;
    }

    const hasMoveMembers = botMember.permissions.has(PermissionFlagsBits.MoveMembers);
    results.push({
        name: 'Bot Move Permission',
        passed: hasMoveMembers,
        details: hasMoveMembers
            ? 'Bot has Move Members permission'
            : 'Bot lacks Move Members permission',
    });

    const channelsToCheck = [
        {id: config.main_vc_id, name: 'Main VC'},
        {id: config.team1_vc_id, name: 'Team 1 VC'},
        {id: config.team2_vc_id, name: 'Team 2 VC'},
    ];

    for (const {id, name} of channelsToCheck) {
        if (!id) continue;

        try {
            const channel = await interaction.guild!.channels.fetch(id);
            if (channel && channel.isVoiceBased()) {
                const perms = channel.permissionsFor(botMember);
                const canConnect = perms?.has(PermissionFlagsBits.Connect) ?? false;
                const canMove = perms?.has(PermissionFlagsBits.MoveMembers) ?? false;

                results.push({
                    name: `Bot Perms in ${name}`,
                    passed: canConnect && canMove,
                    details: `Connect: ${canConnect ? '✓' : '✗'}, Move: ${canMove ? '✓' : '✗'}`,
                });
            }
        } catch {
            // Channel fetch errors handled elsewhere
        }
    }

    return results;
}

async function testMoveSequence(
    interaction: ChatInputCommandInteraction,
    config: any,
    member: GuildMember
): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const originalChannel = member.voice.channel;

    if (!originalChannel) {
        results.push({
            name: 'Move Sequence',
            passed: false,
            details: 'User left voice channel before move test',
        });
        return results;
    }

    try {
        // Fetch all channels
        const mainVC = (await interaction.guild!.channels.fetch(config.main_vc_id)) as VoiceChannel;
        const team1VC = (await interaction.guild!.channels.fetch(config.team1_vc_id)) as VoiceChannel;
        const team2VC = (await interaction.guild!.channels.fetch(config.team2_vc_id)) as VoiceChannel;

        // Re-fetch member to get fresh voice state
        let currentMember = await interaction.guild!.members.fetch(member.id);

        // Move to Team 1 VC
        await interaction.editReply({
            content: 'Moving to Team 1 VC...',
        });
        await currentMember.voice.setChannel(team1VC);
        results.push({
            name: 'Move to Team 1 VC',
            passed: true,
            details: `Moved to ${team1VC.name}`,
        });

        await sleep(2000);

        // Re-fetch and move to Team 2 VC
        currentMember = await interaction.guild!.members.fetch(member.id);
        if (!currentMember.voice.channel) {
            results.push({
                name: 'Move to Team 2 VC',
                passed: false,
                details: 'User disconnected during test',
            });
            return results;
        }

        await interaction.editReply({
            content: 'Moving to Team 2 VC...',
        });
        await currentMember.voice.setChannel(team2VC);
        results.push({
            name: 'Move to Team 2 VC',
            passed: true,
            details: `Moved to ${team2VC.name}`,
        });

        await sleep(2000);

        // Re-fetch and move back to Main VC
        currentMember = await interaction.guild!.members.fetch(member.id);
        if (!currentMember.voice.channel) {
            results.push({
                name: 'Move to Main VC',
                passed: false,
                details: 'User disconnected during test',
            });
            return results;
        }

        await interaction.editReply({
            content: 'Moving back to Main VC...',
        });
        await currentMember.voice.setChannel(mainVC);
        results.push({
            name: 'Move to Main VC',
            passed: true,
            details: `Moved to ${mainVC.name}`,
        });

    } catch (error) {
        results.push({
            name: 'Move Sequence',
            passed: false,
            details: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }

    return results;
}

async function sendResults(
    interaction: ChatInputCommandInteraction,
    results: TestResult[],
    summary: string
) {
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const allPassed = passed === total;

    const embed = new EmbedBuilder()
        .setTitle('Bot Functionality Test Results')
        .setColor(allPassed ? 0x00ff00 : passed > 0 ? 0xffaa00 : 0xff0000)
        .setDescription(`${summary}\n\n**${passed}/${total} tests passed**`)
        .addFields(
            results.map((r) => ({
                name: `${r.passed ? '✅' : '❌'} ${r.name}`,
                value: r.details,
                inline: false,
            }))
        )
        .setTimestamp();

    await interaction.editReply({
        content: '',
        embeds: [embed],
    });
}
