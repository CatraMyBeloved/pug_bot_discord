import {ButtonInteraction, ChannelSelectMenuInteraction, MessageFlags, RoleSelectMenuInteraction} from 'discord.js';
import Database from 'better-sqlite3';
import {wizardState, WizardSession, WizardCategory} from '../wizard/WizardState';
import {
    buildAnnouncementsComponents,
    buildAnnouncementsEmbed,
    buildMainMenuButtons,
    buildMainMenuEmbed,
    buildReviewButtons,
    buildReviewEmbed,
    buildRolesComponents,
    buildRolesEmbed,
    buildSettingsButtons,
    buildSettingsEmbed,
    buildVoiceChannelsComponents,
    buildVoiceChannelsEmbed
} from '../wizard/wizardUI';
import {validateVoiceChannelUniqueness} from '../wizard/wizardValidation';
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
    const action = parts[1]; // navigate, toggle, back, review, confirm, cancel
    const target = parts[2]; // category name or action target

    try {
        if (action === 'navigate') {
            await handleNavigate(interaction, session, target);
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
    session: WizardSession,
    category: string
) {
    // Validate that category is a valid WizardCategory
    const validCategories: WizardCategory[] = ['voice_channels', 'roles', 'announcements', 'settings'];
    if (!validCategories.includes(category as WizardCategory)) {
        await interaction.reply({
            content: 'Invalid category.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    session.currentCategory = category as WizardCategory;

    let embed, components;

    switch (category) {
        case 'voice_channels':
            embed = buildVoiceChannelsEmbed(session);
            components = buildVoiceChannelsComponents();
            break;
        case 'roles':
            embed = buildRolesEmbed(session);
            components = buildRolesComponents();
            break;
        case 'announcements':
            embed = buildAnnouncementsEmbed(session);
            components = buildAnnouncementsComponents();
            break;
        case 'settings':
            embed = buildSettingsEmbed(session);
            components = buildSettingsButtons(session.settings.autoMove);
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
        components: components
    });
}


async function handleToggle(
    interaction: ButtonInteraction,
    session: WizardSession,
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
    session: WizardSession
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
    session: WizardSession
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
    session: WizardSession,
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
    session: WizardSession
) {
    wizardState.deleteSession(session.userId, session.guildId);

    await interaction.update({
        content: '**[CANCELLED]** Setup wizard cancelled. No changes were saved.',
        embeds: [],
        components: []
    });
}

// Select menu handler
export async function handleWizardSelectMenu(
    interaction: ChannelSelectMenuInteraction | RoleSelectMenuInteraction,
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
    const selectType = customId.split(':')[2]; // wizard:select:TYPE

    try {
        if (selectType === 'main_vc') {
            await handleChannelSelect(interaction as ChannelSelectMenuInteraction, session, 'mainVcId', 'Main VC');
        } else if (selectType === 'team1_vc') {
            await handleChannelSelect(interaction as ChannelSelectMenuInteraction, session, 'team1VcId', 'Team 1 VC');
        } else if (selectType === 'team2_vc') {
            await handleChannelSelect(interaction as ChannelSelectMenuInteraction, session, 'team2VcId', 'Team 2 VC');
        } else if (selectType === 'announcement_channel') {
            await handleChannelSelect(interaction as ChannelSelectMenuInteraction, session, 'announcementChannelId', 'Announcement Channel');
        } else if (selectType === 'pug_role') {
            await handleRoleSelect(interaction as RoleSelectMenuInteraction, session, 'pugRoleId', 'PUG Role');
        } else if (selectType === 'pug_leader_roles') {
            await handleLeaderRolesSelect(interaction as RoleSelectMenuInteraction, session);
        } else {
            await interaction.reply({
                content: 'Unknown select menu type.',
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Wizard select menu error:', error);
        await interaction.reply({
            content: 'An error occurred processing your selection. Please try again.',
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
}

async function handleChannelSelect(
    interaction: ChannelSelectMenuInteraction,
    session: WizardSession,
    settingKey: string,
    displayName: string
) {
    const channelId = interaction.values[0];

    // Update session
    wizardState.updateSettings(session.userId, session.guildId, {
        [settingKey]: channelId
    });

    // Refresh the view
    await refreshView(interaction, session);

    await interaction.followUp({
        content: `**[SUCCESS]** ${displayName} set to <#${channelId}>`,
        flags: MessageFlags.Ephemeral
    });
}

async function handleRoleSelect(
    interaction: RoleSelectMenuInteraction,
    session: WizardSession,
    settingKey: string,
    displayName: string
) {
    const roleId = interaction.values[0];

    // Update session
    wizardState.updateSettings(session.userId, session.guildId, {
        [settingKey]: roleId
    });

    // Refresh the view
    await refreshView(interaction, session);

    await interaction.followUp({
        content: `**[SUCCESS]** ${displayName} set to <@&${roleId}>`,
        flags: MessageFlags.Ephemeral
    });
}

async function handleLeaderRolesSelect(
    interaction: RoleSelectMenuInteraction,
    session: WizardSession
) {
    const roleIds = interaction.values;

    // Update session with all selected roles
    wizardState.updateSettings(session.userId, session.guildId, {
        pugLeaderRoleIds: roleIds
    });

    // Refresh the view
    await refreshView(interaction, session);

    const roleList = roleIds.map(id => `<@&${id}>`).join(', ');
    await interaction.followUp({
        content: `**[SUCCESS]** PUG Leader Roles set to: ${roleList}`,
        flags: MessageFlags.Ephemeral
    });
}

async function refreshView(
    interaction: ChannelSelectMenuInteraction | RoleSelectMenuInteraction,
    session: WizardSession
) {
    const category = session.currentCategory;
    if (!category) return;

    let embed, components;

    switch (category) {
        case 'voice_channels':
            embed = buildVoiceChannelsEmbed(session);
            components = buildVoiceChannelsComponents();
            break;
        case 'roles':
            embed = buildRolesEmbed(session);
            components = buildRolesComponents();
            break;
        case 'announcements':
            embed = buildAnnouncementsEmbed(session);
            components = buildAnnouncementsComponents();
            break;
        case 'settings':
            embed = buildSettingsEmbed(session);
            components = buildSettingsButtons(session.settings.autoMove);
            break;
        default:
            return;
    }

    await interaction.update({
        embeds: [embed],
        components: components
    });
}
