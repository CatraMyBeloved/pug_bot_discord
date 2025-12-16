import { ButtonInteraction, ModalSubmitInteraction, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { updateState, UpdateStep } from '../wizard/UpdateState';
import {
    buildUpdateBattlenetEmbed,
    buildUpdateBattlenetButtons,
    buildUpdateBattlenetModal,
    buildUpdateRolesEmbed,
    buildUpdateRolesButtons,
    buildUpdateRankEmbed,
    buildUpdateRankButtons,
    buildUpdateReviewEmbed,
    buildUpdateReviewButtons,
} from '../wizard/updateUI';
import { validateBattlenetId, validateRegistrationComplete } from '../wizard/registrationValidation';
import { updatePlayer } from '../database/players';
import { Role, Rank } from '../types/matchmaking';

// ============================================================================ 
// Main Button Handler (Routes to specific handlers)
// ============================================================================ 

export async function handleUpdateButton(
    interaction: ButtonInteraction,
    db: Database.Database
): Promise<void> {
    const customId = interaction.customId;
    const parts = customId.split(':');

    if (parts.length < 2) {
        await interaction.reply({
            content: 'Invalid button interaction.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const action = parts[1]; // e.g., 'modal', 'toggle_role', 'select_rank', 'next', 'back', 'confirm', 'cancel'
    const target = parts[2]; // e.g., 'battlenet', 'tank', 'bronze', 'rank', etc.

    try {
        switch (action) {
            case 'modal':
                await handleModalOpen(interaction);
                break;
            case 'toggle_role':
                await handleRoleToggle(interaction, target as Role);
                break;
            case 'select_rank':
                await handleRankSelect(interaction, target as Rank);
                break;
            case 'next':
                await handleNext(interaction, target as UpdateStep);
                break;
            case 'back':
                await handleBack(interaction, target as UpdateStep);
                break;
            case 'confirm':
                await handleConfirm(interaction, db);
                break;
            case 'cancel':
                await handleCancel(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown button action.',
                    flags: MessageFlags.Ephemeral,
                });
        }
    } catch (error) {
        console.error('Error handling update button:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred. Please try again.',
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}

// ============================================================================ 
// Main Modal Handler
// ============================================================================ 

export async function handleUpdateModal(
    interaction: ModalSubmitInteraction,
    db: Database.Database
): Promise<void> {
    const customId = interaction.customId;

    if (customId === 'update:submit:battlenet') {
        await handleBattlenetSubmit(interaction);
    } else {
        await interaction.reply({
            content: 'Unknown modal interaction.',
            flags: MessageFlags.Ephemeral,
        });
    }
}

// ============================================================================ 
// Individual Handlers
// ============================================================================ 

async function handleModalOpen(interaction: ButtonInteraction): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your update session has expired. Please run `/update` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const modal = buildUpdateBattlenetModal(session.data.battlenetId);
    await interaction.showModal(modal);
}

async function handleBattlenetSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your update session has expired. Please run `/update` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const battlenetId = interaction.fields.getTextInputValue('battlenet_input').trim();

    // Validate Battle.net ID format
    const validation = validateBattlenetId(battlenetId);
    if (!validation.valid) {
        await interaction.reply({
            content: `**Invalid Battle.net ID**\n\n${validation.error}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update session with Battle.net ID and advance to roles step
    updateState.updateData(interaction.user.id, { battlenetId });
    updateState.updateSession(interaction.user.id, { currentStep: 'roles' });

    // Update message to show roles selection
    await interaction.deferUpdate();

    const updatedSession = updateState.getSession(interaction.user.id)!;
    const embed = buildUpdateRolesEmbed(updatedSession);
    const buttons = buildUpdateRolesButtons(updatedSession.data.selectedRoles);

    await interaction.editReply({
        embeds: [embed],
        components: buttons,
    });
}

async function handleRoleToggle(interaction: ButtonInteraction, role: Role): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your update session has expired. Please run `/update` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const { selectedRoles } = session.data;
    const roleIndex = selectedRoles.indexOf(role);

    if (roleIndex > -1) {
        // Role is already selected, remove it
        selectedRoles.splice(roleIndex, 1);
    } else {
        // Role is not selected, add it
        selectedRoles.push(role);
    }

    // Update session
    updateState.updateData(interaction.user.id, { selectedRoles });

    // Refresh UI
    const updatedSession = updateState.getSession(interaction.user.id)!;
    const embed = buildUpdateRolesEmbed(updatedSession);
    const buttons = buildUpdateRolesButtons(updatedSession.data.selectedRoles);

    await interaction.update({
        embeds: [embed],
        components: buttons,
    });
}

async function handleRankSelect(interaction: ButtonInteraction, rank: Rank): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your update session has expired. Please run `/update` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update session with selected rank
    updateState.updateData(interaction.user.id, { selectedRank: rank });

    // Refresh UI
    const updatedSession = updateState.getSession(interaction.user.id)!;
    const embed = buildUpdateRankEmbed(updatedSession);
    const buttons = buildUpdateRankButtons(updatedSession.data.selectedRank);

    await interaction.update({
        embeds: [embed],
        components: buttons,
    });
}

async function handleNext(interaction: ButtonInteraction, targetStep: UpdateStep): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your update session has expired. Please run `/update` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update current step
    updateState.updateSession(interaction.user.id, { currentStep: targetStep });

    const updatedSession = updateState.getSession(interaction.user.id)!;

    // Render appropriate UI for the target step
    let embed;
    let buttons;

    switch (targetStep) {
        case 'roles': // added for "Keep & Next" on Battlenet step
             embed = buildUpdateRolesEmbed(updatedSession);
             buttons = buildUpdateRolesButtons(updatedSession.data.selectedRoles);
             break;
        case 'rank':
            embed = buildUpdateRankEmbed(updatedSession);
            buttons = buildUpdateRankButtons(updatedSession.data.selectedRank);
            break;
        case 'review':
            embed = buildUpdateReviewEmbed(updatedSession);
            buttons = buildUpdateReviewButtons();
            break;
        default:
            await interaction.reply({
                content: 'Invalid next step.',
                flags: MessageFlags.Ephemeral,
            });
            return;
    }

    await interaction.update({
        embeds: [embed],
        components: buttons,
    });
}

async function handleBack(interaction: ButtonInteraction, targetStep: UpdateStep): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your update session has expired. Please run `/update` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update current step
    updateState.updateSession(interaction.user.id, { currentStep: targetStep });

    const updatedSession = updateState.getSession(interaction.user.id)!;

    // Render appropriate UI for the target step
    let embed;
    let buttons;

    switch (targetStep) {
        case 'battlenet':
            embed = buildUpdateBattlenetEmbed(updatedSession);
            buttons = buildUpdateBattlenetButtons();
            break;
        case 'roles':
            embed = buildUpdateRolesEmbed(updatedSession);
            buttons = buildUpdateRolesButtons(updatedSession.data.selectedRoles);
            break;
        case 'rank':
            embed = buildUpdateRankEmbed(updatedSession);
            buttons = buildUpdateRankButtons(updatedSession.data.selectedRank);
            break;
        default:
            await interaction.reply({
                content: 'Invalid back step.',
                flags: MessageFlags.Ephemeral,
            });
            return;
    }

    await interaction.update({
        embeds: [embed],
        components: buttons,
    });
}

async function handleConfirm(interaction: ButtonInteraction, db: Database.Database): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your update session has expired. Please run `/update` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Validate that all data is complete (reusing registration validation)
    const validation = validateRegistrationComplete(session.data);
    if (!validation.valid) {
        await interaction.reply({
            content: `**Update Incomplete**\n\n${validation.error}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const { battlenetId, selectedRoles, selectedRank } = session.data;

    try {
        // Update player in database
        updatePlayer(db, interaction.user.id, battlenetId!, selectedRoles, selectedRank!);

        // Delete session
        updateState.deleteSession(interaction.user.id);

        // Show success message
        const successMessage = `**✅ Profile Updated Successfully!**

**Battle.net ID:** ${battlenetId}
**Roles:** ${selectedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
**Rank:** ${selectedRank!.charAt(0).toUpperCase() + selectedRank!.slice(1)}`;

        await interaction.update({
            content: successMessage,
            embeds: [],
            components: [],
        });
    } catch (error) {
        console.error('Update error:', error);
        await interaction.reply({
            content: '**❌ Update Failed**\n\nAn error occurred while saving your changes. Please try again or contact an administrator.',
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleCancel(interaction: ButtonInteraction): Promise<void> {
    const session = updateState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'No active update session found.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Delete session
    updateState.deleteSession(interaction.user.id);

    await interaction.update({
        content: '**Update Cancelled**\n\nYour profile update has been cancelled. No changes were made.',
        embeds: [],
        components: [],
    });
}
