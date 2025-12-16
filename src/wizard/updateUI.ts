import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { UpdateSession } from './UpdateState';
import { Role, Rank } from '../types/matchmaking';

// ============================================================================ 
// STEP 1: Battle.net ID Input
// ============================================================================ 

export function buildUpdateBattlenetEmbed(session: UpdateSession): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle('Update Profile - Step 1 of 4: Battle.net ID')
        .setDescription(
            'Click the button below to update your Battle.net ID.\n\n' +
            '**Format:** Name#1234\n' +
            '**Examples:** Player#1234, CoolGamer#5678'
        )
        .setColor(0xe67e22); // Orange

    if (session.data.battlenetId) {
        embed.addFields({
            name: 'Current Battle.net ID',
            value: session.data.battlenetId,
        });
    }

    return embed;
}

export function buildUpdateBattlenetButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:modal:battlenet')
            .setLabel('Update Battle.net ID')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('update:next:roles')
            .setLabel('Keep & Next')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:cancel')
            .setLabel('Cancel Update')
            .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2];
}

export function buildUpdateBattlenetModal(currentValue: string | null): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId('update:submit:battlenet')
        .setTitle('Update Your Battle.net ID');

    const input = new TextInputBuilder()
        .setCustomId('battlenet_input')
        .setLabel('Battle.net ID (e.g., Player#1234)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('YourName#1234')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(50);
    
    if (currentValue) {
        input.setValue(currentValue);
    }

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    return modal;
}

// ============================================================================ 
// STEP 2: Role Selection
// ============================================================================ 

export function buildUpdateRolesEmbed(session: UpdateSession): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle('Update Profile - Step 2 of 4: Roles')
        .setDescription('Select all roles you can play by clicking the buttons below.')
        .setColor(0xe67e22); // Orange

    const { selectedRoles } = session.data;

    if (selectedRoles.length > 0) {
        embed.addFields({
            name: 'Selected Roles',
            value: selectedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', '),
        });
    } else {
        embed.addFields({
            name: 'Selected Roles',
            value: 'None (please select at least one)',
        });
    }

    return embed;
}

export function buildUpdateRolesButtons(selectedRoles: Role[]): ActionRowBuilder<ButtonBuilder>[] {
    const roles: Role[] = ['tank', 'dps', 'support'];

    // Row 1: Role toggle buttons
    const row1 = new ActionRowBuilder<ButtonBuilder>();
    for (const role of roles) {
        const isSelected = selectedRoles.includes(role);
        const button = new ButtonBuilder()
            .setCustomId(`update:toggle_role:${role}`)
            .setLabel(role.charAt(0).toUpperCase() + role.slice(1))
            .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary);
        row1.addComponents(button);
    }

    // Row 2: Navigation buttons
    const canProceed = selectedRoles.length > 0;
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:next:rank')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canProceed),
        new ButtonBuilder()
            .setCustomId('update:back:battlenet')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    // Row 3: Cancel button
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:cancel')
            .setLabel('Cancel Update')
            .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2, row3];
}

// ============================================================================ 
// STEP 3: Rank Selection
// ============================================================================ 

export function buildUpdateRankEmbed(session: UpdateSession): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle('Update Profile - Step 3 of 4: Rank')
        .setDescription('Select your current competitive rank.')
        .setColor(0xe67e22); // Orange

    const { selectedRank } = session.data;

    if (selectedRank) {
        embed.addFields({
            name: 'Selected Rank',
            value: selectedRank.charAt(0).toUpperCase() + selectedRank.slice(1),
        });
    } else {
        embed.addFields({
            name: 'Selected Rank',
            value: 'None (please select a rank)',
        });
    }

    return embed;
}

export function buildUpdateRankButtons(selectedRank: Rank | null): ActionRowBuilder<ButtonBuilder>[] {
    const ranks: Rank[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster'];

    // Row 1: Bronze, Silver, Gold, Platinum
    const row1 = new ActionRowBuilder<ButtonBuilder>();
    for (const rank of ranks.slice(0, 4)) {
        const isSelected = selectedRank === rank;
        const button = new ButtonBuilder()
            .setCustomId(`update:select_rank:${rank}`)
            .setLabel(rank.charAt(0).toUpperCase() + rank.slice(1))
            .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Primary);
        row1.addComponents(button);
    }

    // Row 2: Diamond, Master, Grandmaster
    const row2 = new ActionRowBuilder<ButtonBuilder>();
    for (const rank of ranks.slice(4)) {
        const isSelected = selectedRank === rank;
        const button = new ButtonBuilder()
            .setCustomId(`update:select_rank:${rank}`)
            .setLabel(rank.charAt(0).toUpperCase() + rank.slice(1))
            .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Primary);
        row2.addComponents(button);
    }

    // Row 3: Navigation buttons
    const canProceed = selectedRank !== null;
    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:next:review')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canProceed),
        new ButtonBuilder()
            .setCustomId('update:back:roles')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    // Row 4: Cancel button
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:cancel')
            .setLabel('Cancel Update')
            .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2, row3, row4];
}

// ============================================================================ 
// STEP 4: Review & Confirm
// ============================================================================ 

export function buildUpdateReviewEmbed(session: UpdateSession): EmbedBuilder {
    const { battlenetId, selectedRoles, selectedRank } = session.data;

    const embed = new EmbedBuilder()
        .setTitle('Update Profile - Review & Confirm')
        .setDescription('Please review your updated details and confirm.')
        .setColor(0x2ecc71); // Green

    embed.addFields(
        {
            name: 'Battle.net ID',
            value: battlenetId || 'Not set',
        },
        {
            name: 'Roles',
            value: selectedRoles.length > 0
                ? selectedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')
                : 'Not set',
        },
        {
            name: 'Rank',
            value: selectedRank
                ? selectedRank.charAt(0).toUpperCase() + selectedRank.slice(1)
                : 'Not set',
        }
    );

    return embed;
}

export function buildUpdateReviewButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:confirm:save')
            .setLabel('Confirm & Update')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('update:back:rank')
            .setLabel('Back to Edit')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('update:cancel')
            .setLabel('Cancel Update')
            .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2];
}
