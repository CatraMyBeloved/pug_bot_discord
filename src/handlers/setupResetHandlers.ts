import {ButtonInteraction, GuildMember, MessageFlags} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig, getPugLeaderRoles} from '../database/config';
import {hasMatchPermission} from '../utils/permissions';
import {executeDeferredOperation} from '../utils/interactionHelpers';

export async function handleSetupResetButton(
    interaction: ButtonInteraction,
    db: Database.Database
) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: 'This can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const member = interaction.member as GuildMember;
    const config = getGuildConfig(db, interaction.guildId);
    const pugLeaderRoles = getPugLeaderRoles(db, interaction.guildId);

    // Check permissions
    if (!hasMatchPermission(member, config, pugLeaderRoles)) {
        await interaction.reply({
            content: "You don't have permission to reset configuration.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const customId = interaction.customId;

    // Parse button ID: confirm_reset_123 or cancel_reset_123
    const parts = customId.split('_');
    const action = parts[0]; // "confirm" or "cancel"

    if (action === 'cancel') {
        await interaction.update({
            content: '**[CANCELLED]** Configuration reset cancelled. No changes were made.',
            components: [],
        });
        return;
    }

    if (action === 'confirm') {
        await executeDeferredOperation(
            interaction,
            async () => {
                // Delete all guild configuration
                db.prepare('DELETE FROM guild_config WHERE guild_id = ?').run(interaction.guildId);
                db.prepare('DELETE FROM guild_pug_leader_roles WHERE guild_id = ?').run(interaction.guildId);
            },
            {
                content: '**[SUCCESS]** All bot configuration has been reset.\n\nYou can reconfigure the bot using `/setup`.',
                components: [],
            },
            {
                content: '**[ERROR]** Failed to reset configuration. Please try again or contact an administrator.',
                components: [],
            },
            (msg, error) => console.error('Setup reset error:', error)
        );
        return;
    }

    // Unknown action
    await interaction.reply({
        content: 'Unknown action.',
        flags: MessageFlags.Ephemeral,
    });
}
