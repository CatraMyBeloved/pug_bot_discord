import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import {WizardSession} from './WizardState';

export function buildMainMenuEmbed(session: WizardSession): EmbedBuilder {
    const completed = session.completedCategories;

    const vcStatus = completed.has('voice_channels') ? '**[COMPLETE]**' : '[INCOMPLETE]';
    const rolesStatus = completed.has('roles') ? '**[COMPLETE]**' : '[INCOMPLETE]';
    const announcementsStatus = completed.has('announcements') ? '**[COMPLETE]**' : '[INCOMPLETE]';
    const settingsStatus = completed.has('settings') ? '**[COMPLETE]**' : '[INCOMPLETE]';

    const totalRequired = 4;
    const completedCount = Array.from(completed).length;

    return new EmbedBuilder()
        .setTitle('PUG Bot Setup Wizard')
        .setDescription(`Configure your bot by completing all categories below.\n\n**Progress:** ${completedCount}/${totalRequired} categories complete`)
        .addFields(
            { name: 'Voice Channels', value: vcStatus, inline: true },
            { name: 'Roles', value: rolesStatus, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Announcements', value: announcementsStatus, inline: true },
            { name: 'Settings', value: settingsStatus, inline: true },
            { name: '\u200B', value: '\u200B', inline: true }
        )
        .setColor(completedCount === totalRequired ? 0x00FF00 : 0xFFAA00)
        .setFooter({ text: 'Click a category below to configure it' });
}

export function buildMainMenuButtons(isComplete: boolean): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:navigate:voice_channels')
                .setLabel('Voice Channels')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('wizard:navigate:roles')
                .setLabel('Roles')
                .setStyle(ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:navigate:announcements')
                .setLabel('Announcements')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('wizard:navigate:settings')
                .setLabel('Settings')
                .setStyle(ButtonStyle.Primary)
        );

    const row3 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:review:complete')
                .setLabel('Review & Complete')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!isComplete)
        );

    const row4 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    return [row1, row2, row3, row4];
}

export function buildVoiceChannelsEmbed(session: WizardSession): EmbedBuilder {
    const { settings } = session;

    const mainVc = settings.mainVcId ? `<#${settings.mainVcId}> **[SET]**` : '[NOT SET]';
    const team1Vc = settings.team1VcId ? `<#${settings.team1VcId}> **[SET]**` : '[NOT SET]';
    const team2Vc = settings.team2VcId ? `<#${settings.team2VcId}> **[SET]**` : '[NOT SET]';

    return new EmbedBuilder()
        .setTitle('Voice Channels Configuration')
        .setDescription('Configure the three voice channels used for PUG matches.')
        .addFields(
            { name: 'Main VC (Lobby)', value: mainVc },
            { name: 'Team 1 VC', value: team1Vc },
            { name: 'Team 2 VC', value: team2Vc }
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Right-click a voice channel → Copy Channel ID (Developer Mode must be enabled)' });
}

export function buildVoiceChannelsButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:modal:main_vc')
                .setLabel('Set Main VC')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('wizard:modal:team1_vc')
                .setLabel('Set Team 1 VC')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('wizard:modal:team2_vc')
                .setLabel('Set Team 2 VC')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Primary)
        );

    return [row1, row2];
}

export function buildRolesEmbed(session: WizardSession): EmbedBuilder {
    const { settings } = session;

    const pugRole = settings.pugRoleId ? `<@&${settings.pugRoleId}> **[SET]**` : '[NOT SET]';
    const leaderRoles = settings.pugLeaderRoleIds.length > 0
        ? settings.pugLeaderRoleIds.map(id => `<@&${id}>`).join(', ') + ' **[SET]**'
        : '[NOT SET]';

    return new EmbedBuilder()
        .setTitle('Roles Configuration')
        .setDescription('Configure the roles used for PUG management.')
        .addFields(
            { name: 'PUG Role', value: pugRole },
            { name: 'PUG Leader Roles', value: leaderRoles }
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Right-click a role → Copy Role ID (Developer Mode must be enabled)' });
}

export function buildRolesButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:modal:pug_role')
                .setLabel('Set PUG Role')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('wizard:modal:add_leader_role')
                .setLabel('Add PUG Leader Role')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Primary)
        );

    return [row1, row2];
}

export function buildAnnouncementsEmbed(session: WizardSession): EmbedBuilder {
    const { settings } = session;

    const channel = settings.announcementChannelId
        ? `<#${settings.announcementChannelId}> **[SET]**`
        : '[NOT SET]';

    return new EmbedBuilder()
        .setTitle('Announcements Configuration')
        .setDescription('Configure the channel where PUG announcements and reminders will be sent.')
        .addFields({ name: 'Announcement Channel', value: channel })
        .setColor(0x5865F2)
        .setFooter({ text: 'Right-click a text channel → Copy Channel ID' });
}

export function buildAnnouncementsButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:modal:announcement_channel')
                .setLabel('Set Announcement Channel')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Primary)
        );

    return [row1, row2];
}

export function buildSettingsEmbed(session: WizardSession): EmbedBuilder {
    const { settings } = session;

    const autoMove = settings.autoMove ? '**ENABLED**' : 'DISABLED';
    const description = settings.autoMove
        ? 'Players will be automatically moved to their team voice channels when a match starts.'
        : 'Players will NOT be automatically moved. They must join team voice channels manually.';

    return new EmbedBuilder()
        .setTitle('Bot Settings')
        .setDescription(description)
        .addFields({ name: 'Auto-move to Team VCs', value: autoMove })
        .setColor(0x5865F2);
}

export function buildSettingsButtons(currentValue: boolean): ActionRowBuilder<ButtonBuilder>[] {
    const label = currentValue ? 'Disable Auto-move' : 'Enable Auto-move';

    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:toggle:auto_move')
                .setLabel(label)
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Primary)
        );

    return [row1, row2];
}

export function buildReviewEmbed(session: WizardSession): EmbedBuilder {
    const { settings } = session;

    return new EmbedBuilder()
        .setTitle('Review Configuration')
        .setDescription('Please review your configuration before finalizing.')
        .addFields(
            { name: 'Main VC', value: `<#${settings.mainVcId}>`, inline: true },
            { name: 'Team 1 VC', value: `<#${settings.team1VcId}>`, inline: true },
            { name: 'Team 2 VC', value: `<#${settings.team2VcId}>`, inline: true },
            { name: 'PUG Role', value: `<@&${settings.pugRoleId}>`, inline: true },
            { name: 'PUG Leader Roles', value: settings.pugLeaderRoleIds.map(id => `<@&${id}>`).join(', '), inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Announcement Channel', value: `<#${settings.announcementChannelId}>`, inline: true },
            { name: 'Auto-move', value: settings.autoMove ? 'Enabled' : 'Disabled', inline: true }
        )
        .setColor(0x00FF00);
}

export function buildReviewButtons(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:confirm:save')
                .setLabel('Confirm & Save')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Edit')
                .setStyle(ButtonStyle.Secondary)
        );

    return [row1];
}

// Modal builders
export function buildChannelModal(type: 'main_vc' | 'team1_vc' | 'team2_vc' | 'announcement_channel'): ModalBuilder {
    const titles = {
        main_vc: 'Set Main Voice Channel',
        team1_vc: 'Set Team 1 Voice Channel',
        team2_vc: 'Set Team 2 Voice Channel',
        announcement_channel: 'Set Announcement Channel'
    };

    const labels = {
        main_vc: 'Main VC Channel ID',
        team1_vc: 'Team 1 VC Channel ID',
        team2_vc: 'Team 2 VC Channel ID',
        announcement_channel: 'Announcement Channel ID'
    };

    const modal = new ModalBuilder()
        .setCustomId(`wizard_modal:${type}`)
        .setTitle(titles[type]);

    const input = new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel(labels[type])
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('123456789012345678')
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    return modal;
}

export function buildRoleModal(type: 'pug_role' | 'add_leader_role'): ModalBuilder {
    const titles = {
        pug_role: 'Set PUG Role',
        add_leader_role: 'Add PUG Leader Role'
    };

    const labels = {
        pug_role: 'PUG Role ID',
        add_leader_role: 'PUG Leader Role ID'
    };

    const modal = new ModalBuilder()
        .setCustomId(`wizard_modal:${type}`)
        .setTitle(titles[type]);

    const input = new TextInputBuilder()
        .setCustomId('role_id')
        .setLabel(labels[type])
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('123456789012345678')
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    return modal;
}
