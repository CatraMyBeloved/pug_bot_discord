import { ButtonInteraction, ModalSubmitInteraction, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { registrationState, RegistrationStep } from '../wizard/RegistrationState';
import {
    buildBattlenetEmbed,
    buildBattlenetButtons,
    buildBattlenetModal,
    buildRolesEmbed,
    buildRolesButtons,
    buildRankEmbed,
    buildRankButtons,
    buildReviewEmbed,
    buildReviewButtons,
} from '../wizard/registrationUI';
import { validateBattlenetId, validateRegistrationComplete } from '../wizard/registrationValidation';
import { registerPlayer } from '../database/players';
import { Role, Rank } from '../types/matchmaking';
import { executeDeferredOperation } from '../utils/interactionHelpers';

// ============================================================================
// Main Button Handler (Routes to specific handlers)
// ============================================================================

export async function handleRegistrationButton(
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
                await handleNext(interaction, target as RegistrationStep);
                break;
            case 'back':
                await handleBack(interaction, target as RegistrationStep);
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
        console.error('Error handling registration button:', error);
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

export async function handleRegistrationModal(
    interaction: ModalSubmitInteraction,
    db: Database.Database
): Promise<void> {
    const customId = interaction.customId;

    if (customId === 'register:submit:battlenet') {
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
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your registration session has expired. Please run `/register` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const modal = buildBattlenetModal();
    await interaction.showModal(modal);
}

async function handleBattlenetSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your registration session has expired. Please run `/register` again to start over.',
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
    registrationState.updateData(interaction.user.id, { battlenetId });
    registrationState.updateSession(interaction.user.id, { currentStep: 'roles' });

    // Update message to show roles selection
    // Note: Modal submissions require deferring and then editing the original message
    await interaction.deferUpdate();

    const updatedSession = registrationState.getSession(interaction.user.id)!;
    const embed = buildRolesEmbed(updatedSession);
    const buttons = buildRolesButtons(updatedSession.data.selectedRoles);

    await interaction.editReply({
        embeds: [embed],
        components: buttons,
    });
}

async function handleRoleToggle(interaction: ButtonInteraction, role: Role): Promise<void> {
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your registration session has expired. Please run `/register` again to start over.',
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
    registrationState.updateData(interaction.user.id, { selectedRoles });

    // Refresh UI
    const updatedSession = registrationState.getSession(interaction.user.id)!;
    const embed = buildRolesEmbed(updatedSession);
    const buttons = buildRolesButtons(updatedSession.data.selectedRoles);

    await interaction.update({
        embeds: [embed],
        components: buttons,
    });
}

async function handleRankSelect(interaction: ButtonInteraction, rank: Rank): Promise<void> {
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your registration session has expired. Please run `/register` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update session with selected rank
    registrationState.updateData(interaction.user.id, { selectedRank: rank });

    // Refresh UI
    const updatedSession = registrationState.getSession(interaction.user.id)!;
    const embed = buildRankEmbed(updatedSession);
    const buttons = buildRankButtons(updatedSession.data.selectedRank);

    await interaction.update({
        embeds: [embed],
        components: buttons,
    });
}

async function handleNext(interaction: ButtonInteraction, targetStep: RegistrationStep): Promise<void> {
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your registration session has expired. Please run `/register` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update current step
    registrationState.updateSession(interaction.user.id, { currentStep: targetStep });

    const updatedSession = registrationState.getSession(interaction.user.id)!;

    // Render appropriate UI for the target step
    let embed;
    let buttons;

    switch (targetStep) {
        case 'rank':
            embed = buildRankEmbed(updatedSession);
            buttons = buildRankButtons(updatedSession.data.selectedRank);
            break;
        case 'review':
            embed = buildReviewEmbed(updatedSession);
            buttons = buildReviewButtons();
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

async function handleBack(interaction: ButtonInteraction, targetStep: RegistrationStep): Promise<void> {
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your registration session has expired. Please run `/register` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Update current step
    registrationState.updateSession(interaction.user.id, { currentStep: targetStep });

    const updatedSession = registrationState.getSession(interaction.user.id)!;

    // Render appropriate UI for the target step
    let embed;
    let buttons;

    switch (targetStep) {
        case 'battlenet':
            embed = buildBattlenetEmbed(updatedSession);
            buttons = buildBattlenetButtons();
            break;
        case 'roles':
            embed = buildRolesEmbed(updatedSession);
            buttons = buildRolesButtons(updatedSession.data.selectedRoles);
            break;
        case 'rank':
            embed = buildRankEmbed(updatedSession);
            buttons = buildRankButtons(updatedSession.data.selectedRank);
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
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'Your registration session has expired. Please run `/register` again to start over.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Validate that all data is complete
    const validation = validateRegistrationComplete(session.data);
    if (!validation.valid) {
        await interaction.reply({
            content: `**Registration Incomplete**\n\n${validation.error}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const { battlenetId, selectedRoles, selectedRank } = session.data;

    const successMessage = `**✅ Registration Successful!**

**Battle.net ID:** ${battlenetId}
**Roles:** ${selectedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
**Rank:** ${selectedRank!.charAt(0).toUpperCase() + selectedRank!.slice(1)}

You can now participate in PUG matches!`;

    await executeDeferredOperation(
        interaction,
        async () => {
            // Register player in database
            registerPlayer(db, interaction.user.id, battlenetId!, selectedRoles, selectedRank!);

            // Delete session
            registrationState.deleteSession(interaction.user.id);
        },
        {
            content: successMessage,
            embeds: [],
            components: [],
        },
        {
            content: '**❌ Registration Failed**\n\nAn error occurred while saving your registration. Please try again or contact an administrator.',
            embeds: [],
            components: [],
        },
        (msg, error) => console.error('Registration error:', error)
    );
}

async function handleCancel(interaction: ButtonInteraction): Promise<void> {
    const session = registrationState.getSession(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: 'No active registration session found.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Delete session
    registrationState.deleteSession(interaction.user.id);

    await interaction.update({
        content: '**Registration Cancelled**\n\nYour registration has been cancelled. Run `/register` again if you want to register.',
        embeds: [],
        components: [],
    });
}
