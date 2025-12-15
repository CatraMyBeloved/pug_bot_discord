import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    RoleSelectMenuBuilder
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
            {name: 'Voice Channels', value: vcStatus, inline: true},
            {name: 'Roles', value: rolesStatus, inline: true},
            {name: '\u200B', value: '\u200B', inline: true},
            {name: 'Announcements', value: announcementsStatus, inline: true},
            {name: 'Settings', value: settingsStatus, inline: true},
            {name: '\u200B', value: '\u200B', inline: true}
        )
        .setColor(completedCount === totalRequired ? 0x00FF00 : 0xFFAA00)
        .setFooter({text: 'Click a category below to configure it'});
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
    const {settings} = session;

    const mainVc = settings.mainVcId ? `<#${settings.mainVcId}> **[SET]**` : '[NOT SET]';
    const team1Vc = settings.team1VcId ? `<#${settings.team1VcId}> **[SET]**` : '[NOT SET]';
    const team2Vc = settings.team2VcId ? `<#${settings.team2VcId}> **[SET]**` : '[NOT SET]';

    return new EmbedBuilder()
        .setTitle('Voice Channels Configuration')
        .setDescription('Configure the three voice channels used for PUG matches.')
        .addFields(
            {name: 'Main VC (Lobby)', value: mainVc},
            {name: 'Team 1 VC', value: team1Vc},
            {name: 'Team 2 VC', value: team2Vc}
        )
        .setColor(0x5865F2)
        .setFooter({text: 'Select channels from the dropdowns below'});
}

export function buildVoiceChannelsComponents(): ActionRowBuilder<ChannelSelectMenuBuilder | ButtonBuilder>[] {
    const mainVcRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('wizard:select:main_vc')
                .setPlaceholder('Select Main Voice Channel (Lobby)')
                .addChannelTypes(ChannelType.GuildVoice)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const team1VcRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('wizard:select:team1_vc')
                .setPlaceholder('Select Team 1 Voice Channel')
                .addChannelTypes(ChannelType.GuildVoice)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const team2VcRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('wizard:select:team2_vc')
                .setPlaceholder('Select Team 2 Voice Channel')
                .addChannelTypes(ChannelType.GuildVoice)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const backRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Primary)
        );

    return [mainVcRow, team1VcRow, team2VcRow, backRow];
}

export function buildRolesEmbed(session: WizardSession): EmbedBuilder {
    const {settings} = session;

    const pugRole = settings.pugRoleId ? `<@&${settings.pugRoleId}> **[SET]**` : '[NOT SET]';
    const leaderRoles = settings.pugLeaderRoleIds.length > 0
        ? settings.pugLeaderRoleIds.map(id => `<@&${id}>`).join(', ') + ' **[SET]**'
        : '[NOT SET]';

    return new EmbedBuilder()
        .setTitle('Roles Configuration')
        .setDescription('Configure the roles used for PUG management.')
        .addFields(
            {name: 'PUG Role', value: pugRole},
            {name: 'PUG Leader Roles (can select multiple)', value: leaderRoles}
        )
        .setColor(0x5865F2)
        .setFooter({text: 'Select roles from the dropdowns below'});
}

export function buildRolesComponents(): ActionRowBuilder<RoleSelectMenuBuilder | ButtonBuilder>[] {
    const pugRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
        .addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('wizard:select:pug_role')
                .setPlaceholder('Select PUG Role (for @mentions)')
                .setMinValues(1)
                .setMaxValues(1)
        );

    const leaderRolesRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
        .addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('wizard:select:pug_leader_roles')
                .setPlaceholder('Select PUG Leader Roles (can select multiple)')
                .setMinValues(1)
                .setMaxValues(25)
        );

    const backRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Primary)
        );

    return [pugRoleRow, leaderRolesRow, backRow];
}

export function buildAnnouncementsEmbed(session: WizardSession): EmbedBuilder {
    const {settings} = session;

    const channel = settings.announcementChannelId
        ? `<#${settings.announcementChannelId}> **[SET]**`
        : '[NOT SET]';

    return new EmbedBuilder()
        .setTitle('Announcements Configuration')
        .setDescription('Configure the channel where PUG announcements and reminders will be sent.')
        .addFields({name: 'Announcement Channel', value: channel})
        .setColor(0x5865F2)
        .setFooter({text: 'Select a text channel from the dropdown below'});
}

export function buildAnnouncementsComponents(): ActionRowBuilder<ChannelSelectMenuBuilder | ButtonBuilder>[] {
    const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('wizard:select:announcement_channel')
                .setPlaceholder('Select Announcement Channel')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const backRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wizard:back:menu')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Primary)
        );

    return [channelRow, backRow];
}

export function buildSettingsEmbed(session: WizardSession): EmbedBuilder {
    const {settings} = session;

    const autoMove = settings.autoMove ? '**ENABLED**' : 'DISABLED';
    const description = settings.autoMove
        ? 'Players will be automatically moved to their team voice channels when a match starts.'
        : 'Players will NOT be automatically moved. They must join team voice channels manually.';

    return new EmbedBuilder()
        .setTitle('Bot Settings')
        .setDescription(description)
        .addFields({name: 'Auto-move to Team VCs', value: autoMove})
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
    const {settings} = session;

    return new EmbedBuilder()
        .setTitle('Review Configuration')
        .setDescription('Please review your configuration before finalizing.')
        .addFields(
            {name: 'Main VC', value: `<#${settings.mainVcId}>`, inline: true},
            {name: 'Team 1 VC', value: `<#${settings.team1VcId}>`, inline: true},
            {name: 'Team 2 VC', value: `<#${settings.team2VcId}>`, inline: true},
            {name: 'PUG Role', value: `<@&${settings.pugRoleId}>`, inline: true},
            {
                name: 'PUG Leader Roles',
                value: settings.pugLeaderRoleIds.map(id => `<@&${id}>`).join(', '),
                inline: true
            },
            {name: '\u200B', value: '\u200B', inline: true},
            {name: 'Announcement Channel', value: `<#${settings.announcementChannelId}>`, inline: true},
            {name: 'Auto-move', value: settings.autoMove ? 'Enabled' : 'Disabled', inline: true}
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

