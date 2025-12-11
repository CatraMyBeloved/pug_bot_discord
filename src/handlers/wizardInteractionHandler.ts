import {ButtonInteraction, ChannelType, MessageFlags, ModalSubmitInteraction} from 'discord.js';
import Database from 'better-sqlite3';
import {wizardState} from '../wizard/WizardState';
import {
    buildAnnouncementsButtons,
    buildAnnouncementsEmbed,
    buildChannelModal,
    buildMainMenuButtons,
    buildMainMenuEmbed,
    buildReviewButtons,
    buildReviewEmbed,
    buildRoleModal,
    buildRolesButtons,
    buildRolesEmbed,
    buildSettingsButtons,
    buildSettingsEmbed,
    buildVoiceChannelsButtons,
    buildVoiceChannelsEmbed
} from '../wizard/wizardUI';
import {validateChannelId, validateRoleId, validateVoiceChannelUniqueness} from '../wizard/wizardValidation';
import {
    addPugLeaderRole,
    getGuildConfig,
    setAnnouncementChannel,
    setAutoMove,
    setMainVC,
    setPugRole,
    setTeam1VC,
    setTeam2VC
} from '../database/config';

export async function handleWizardButton(
    interaction: ButtonInteraction,
    db: Database.Database
) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'This can only be used in a server.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const session = wizardState.getSession(interaction.user.id, interaction.guildId);
    if (!session) {
        await interaction.reply({
            content: 'Your wizard session has expired. Please run `/setup` again.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const customId = interaction.customId;
    const parts = customId.split(':');
    const action = parts[1]; // navigate, modal, toggle, back, review, confirm, cancel
    const target = parts[2]; // category name or action target

    try {
        if (action === 'navigate') {
            await handleNavigate(interaction, session, target);
        } else if (action === 'modal') {
            await handleModalOpen(interaction, session, target);
        } else if (action === 'toggle') {
            await handleToggle(interaction, session, target, db);
        } else if (action === 'back') {
            await handleBack(interaction, session);
        } else if (action === 'review') {
            await handleReview(interaction, session);
        } else if (action === 'confirm') {
            await handleConfirm(interaction, session, db);
        } else if (action === 'cancel') {
            await handleCancel(interaction, session);
        } else {
            await interaction.reply({
                content: 'Unknown wizard action.',
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Wizard button error:', error);
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
}

async function handleNavigate(
    interaction: ButtonInteraction,
    session: any,
    category: string
) {
    session.currentCategory = category;

    let embed, buttons;

    switch (category) {
        case 'voice_channels':
            embed = buildVoiceChannelsEmbed(session);
            buttons = buildVoiceChannelsButtons();
            break;
        case 'roles':
            embed = buildRolesEmbed(session);
            buttons = buildRolesButtons();
            break;
        case 'announcements':
            embed = buildAnnouncementsEmbed(session);
            buttons = buildAnnouncementsButtons();
            break;
        case 'settings':
            embed = buildSettingsEmbed(session);
            buttons = buildSettingsButtons(session.settings.autoMove);
            break;
        default:
            await interaction.reply({
                content: 'Unknown category.',
                flags: MessageFlags.Ephemeral
            });
            return;
    }

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

async function handleModalOpen(
    interaction: ButtonInteraction,
    session: any,
    modalType: string
) {
    let modal;

    if (modalType === 'main_vc' || modalType === 'team1_vc' || modalType === 'team2_vc' || modalType === 'announcement_channel') {
        modal = buildChannelModal(modalType as any);
    } else if (modalType === 'pug_role' || modalType === 'add_leader_role') {
        modal = buildRoleModal(modalType as any);
    } else {
        await interaction.reply({
            content: 'Unknown modal type.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.showModal(modal);
}

async function handleToggle(
    interaction: ButtonInteraction,
    session: any,
    setting: string,
    db: Database.Database
) {
    if (setting === 'auto_move') {
        session.settings.autoMove = !session.settings.autoMove;

        const embed = buildSettingsEmbed(session);
        const buttons = buildSettingsButtons(session.settings.autoMove);

        await interaction.update({
            embeds: [embed],
            components: buttons
        });
    } else {
        await interaction.reply({
            content: 'Unknown setting.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleBack(
    interaction: ButtonInteraction,
    session: any
) {
    session.currentCategory = null;

    const isComplete = wizardState.isComplete(session.userId, session.guildId);
    const embed = buildMainMenuEmbed(session);
    const buttons = buildMainMenuButtons(isComplete);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

async function handleReview(
    interaction: ButtonInteraction,
    session: any
) {
    // Check if wizard is complete
    const incomplete = wizardState.getIncompleteCategories(session.userId, session.guildId);
    if (incomplete.length > 0) {
        await interaction.reply({
            content: `**[ERROR]** Cannot proceed. Please complete the following categories:\n- ${incomplete.join('\n- ')}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Validate voice channel uniqueness
    const uniqueness = validateVoiceChannelUniqueness(
        session.settings.mainVcId,
        session.settings.team1VcId,
        session.settings.team2VcId
    );

    if (!uniqueness.valid) {
        await interaction.reply({
            content: `**[ERROR]** Voice channel validation failed:\n- ${uniqueness.errors.join('\n- ')}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const embed = buildReviewEmbed(session);
    const buttons = buildReviewButtons();

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

async function handleConfirm(
    interaction: ButtonInteraction,
    session: any,
    db: Database.Database
) {
    try {
        const { settings } = session;

        // Save all settings to database in a transaction-like manner
        setMainVC(db, session.guildId, settings.mainVcId!);
        setTeam1VC(db, session.guildId, settings.team1VcId!);
        setTeam2VC(db, session.guildId, settings.team2VcId!);
        setPugRole(db, session.guildId, settings.pugRoleId!);
        setAnnouncementChannel(db, session.guildId, settings.announcementChannelId!);
        setAutoMove(db, session.guildId, settings.autoMove);

        // Clear old PUG leader roles and add new ones
        db.prepare('DELETE FROM guild_pug_leader_roles WHERE guild_id = ?').run(session.guildId);
        for (const roleId of settings.pugLeaderRoleIds) {
            addPugLeaderRole(db, session.guildId, roleId);
        }

        // Clean up session
        wizardState.deleteSession(session.userId, session.guildId);

        await interaction.update({
            content: '**[SUCCESS]** Bot configuration saved successfully! Your PUG bot is now ready to use.',
            embeds: [],
            components: []
        });
    } catch (error) {
        console.error('Failed to save wizard configuration:', error);
        await interaction.reply({
            content: '**[ERROR]** Failed to save configuration. Please try again or contact an administrator.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleCancel(
    interaction: ButtonInteraction,
    session: any
) {
    wizardState.deleteSession(session.userId, session.guildId);

    await interaction.update({
        content: '**[CANCELLED]** Setup wizard cancelled. No changes were saved.',
        embeds: [],
        components: []
    });
}

// Modal submission handler
export async function handleWizardModal(
    interaction: ModalSubmitInteraction,
    db: Database.Database
) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'This can only be used in a server.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const session = wizardState.getSession(interaction.user.id, interaction.guildId);
    if (!session) {
        await interaction.reply({
            content: 'Your wizard session has expired. Please run `/setup` again.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const customId = interaction.customId;
    const modalType = customId.split(':')[1];

    try {
        if (modalType === 'main_vc') {
            await handleChannelModalSubmit(interaction, session, 'mainVcId', ChannelType.GuildVoice);
        } else if (modalType === 'team1_vc') {
            await handleChannelModalSubmit(interaction, session, 'team1VcId', ChannelType.GuildVoice);
        } else if (modalType === 'team2_vc') {
            await handleChannelModalSubmit(interaction, session, 'team2VcId', ChannelType.GuildVoice);
        } else if (modalType === 'announcement_channel') {
            await handleChannelModalSubmit(interaction, session, 'announcementChannelId', ChannelType.GuildText);
        } else if (modalType === 'pug_role') {
            await handleRoleModalSubmit(interaction, session, 'pugRoleId');
        } else if (modalType === 'add_leader_role') {
            await handleLeaderRoleModalSubmit(interaction, session);
        } else {
            await interaction.reply({
                content: 'Unknown modal type.',
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Wizard modal error:', error);
        await interaction.reply({
            content: 'An error occurred processing your input. Please try again.',
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
}

async function handleChannelModalSubmit(
    interaction: ModalSubmitInteraction,
    session: any,
    settingKey: string,
    expectedType: ChannelType
) {
    const channelId = interaction.fields.getTextInputValue('channel_id').trim();

    const validation = await validateChannelId(interaction.guild!, channelId, expectedType);

    if (!validation.valid) {
        await interaction.reply({
            content: `**[ERROR]** ${validation.error}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Update session
    wizardState.updateSettings(session.userId, session.guildId, {
        [settingKey]: channelId
    });

    await interaction.reply({
        content: `**[SUCCESS]** Channel set successfully: <#${channelId}>`,
        flags: MessageFlags.Ephemeral
    });

    // Refresh the current view
    await refreshCurrentView(interaction, session);
}

async function handleRoleModalSubmit(
    interaction: ModalSubmitInteraction,
    session: any,
    settingKey: string
) {
    const roleId = interaction.fields.getTextInputValue('role_id').trim();

    const validation = await validateRoleId(interaction.guild!, roleId);

    if (!validation.valid) {
        await interaction.reply({
            content: `**[ERROR]** ${validation.error}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Update session
    wizardState.updateSettings(session.userId, session.guildId, {
        [settingKey]: roleId
    });

    await interaction.reply({
        content: `**[SUCCESS]** Role set successfully: <@&${roleId}>`,
        flags: MessageFlags.Ephemeral
    });

    // Refresh the current view
    await refreshCurrentView(interaction, session);
}

async function handleLeaderRoleModalSubmit(
    interaction: ModalSubmitInteraction,
    session: any
) {
    const roleId = interaction.fields.getTextInputValue('role_id').trim();

    const validation = await validateRoleId(interaction.guild!, roleId);

    if (!validation.valid) {
        await interaction.reply({
            content: `**[ERROR]** ${validation.error}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Check if role already added
    if (session.settings.pugLeaderRoleIds.includes(roleId)) {
        await interaction.reply({
            content: '**[WARNING]** This role is already added as a PUG Leader role.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Add to array
    session.settings.pugLeaderRoleIds.push(roleId);
    wizardState.updateSettings(session.userId, session.guildId, {
        pugLeaderRoleIds: session.settings.pugLeaderRoleIds
    });

    await interaction.reply({
        content: `**[SUCCESS]** PUG Leader role added: <@&${roleId}>`,
        flags: MessageFlags.Ephemeral
    });

    // Refresh the current view
    await refreshCurrentView(interaction, session);
}

async function refreshCurrentView(interaction: ModalSubmitInteraction, session: any) {
    try {
        const message = await interaction.message?.fetch();
        if (!message) return;

        const category = session.currentCategory;
        if (!category) return;

        let embed, buttons;

        switch (category) {
            case 'voice_channels':
                embed = buildVoiceChannelsEmbed(session);
                buttons = buildVoiceChannelsButtons();
                break;
            case 'roles':
                embed = buildRolesEmbed(session);
                buttons = buildRolesButtons();
                break;
            case 'announcements':
                embed = buildAnnouncementsEmbed(session);
                buttons = buildAnnouncementsButtons();
                break;
            case 'settings':
                embed = buildSettingsEmbed(session);
                buttons = buildSettingsButtons(session.settings.autoMove);
                break;
            default:
                return;
        }

        await message.edit({
            embeds: [embed],
            components: buttons
        });
    } catch (error) {
        console.error('Failed to refresh view:', error);
    }
}
