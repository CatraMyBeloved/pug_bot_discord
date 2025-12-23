import {Client, DiscordAPIError} from 'discord.js';
import Database from 'better-sqlite3';
import {getGuildConfig} from '../database/config';

export type AnnouncementType = 'scheduled' | 'reminder_24h' | 'reminder_1h' | 'cancelled';

export interface PugAnnouncementData {
    pugId?: number;
    scheduledTime: Date;
    discordEventId?: string | null;
    createdBy?: string; // Discord user ID of creator (for 'scheduled' type)
}

/**
 * Sends a PUG announcement to the configured announcement channel.
 *
 * This function handles all PUG-related announcements with consistent formatting
 * and error handling. It never throws exceptions - all errors are logged and
 * the function returns silently to prevent breaking calling code.
 *
 * @param client Discord client instance
 * @param db Database instance
 * @param guildId Guild ID where the announcement should be sent
 * @param announcementType Type of announcement to send
 * @param pugData Data about the PUG for the announcement
 */
export async function sendPugAnnouncement(
    client: Client,
    db: Database.Database,
    guildId: string,
    announcementType: AnnouncementType,
    pugData: PugAnnouncementData
): Promise<void> {
    try {
        const config = getGuildConfig(db, guildId);

        if (!config || !config.announcement_channel_id) {
            console.warn(`No announcement channel configured for guild ${guildId}`);
            return;
        }

        const channel = await client.channels.fetch(config.announcement_channel_id);

        if (!channel || !channel.isTextBased()) {
            console.warn(`Invalid announcement channel for guild ${guildId}`);
            return;
        }

        const message = await buildAnnouncementMessage(
            client,
            guildId,
            announcementType,
            pugData,
            config.pug_role_id
        );

        // Send the message
        if ("send" in channel) {
            await channel.send(message);
        }

        console.log(`Sent ${announcementType} announcement for guild ${guildId}`);
    } catch (error) {
        console.error(`Error sending ${announcementType} announcement for guild ${guildId}:`, error);
        // Never throw - announcements are non-critical
    }
}

/**
 * Builds the announcement message based on the type.
 */
async function buildAnnouncementMessage(
    client: Client,
    guildId: string,
    announcementType: AnnouncementType,
    pugData: PugAnnouncementData,
    pugRoleId: string | null
): Promise<string> {
    const timestamp = Math.floor(pugData.scheduledTime.getTime() / 1000);
    const roleMention = pugRoleId ? `<@&${pugRoleId}>` : 'everyone';

    let eventUrl: string | null = null;
    // Only fetch event URL for active announcements, not cancellations (saves time and avoids errors)
    if (pugData.discordEventId && announcementType !== 'cancelled') {
        try {
            const guild = await client.guilds.fetch(guildId);
            const event = await guild.scheduledEvents.fetch(pugData.discordEventId);
            // @ts-ignore - url property exists but not in type definitions
            eventUrl = event.url;
        } catch (error) {
            // Check if event was already deleted (error code 10070)
            if (error instanceof DiscordAPIError && error.code === 10070) {
                console.log(`Discord event ${pugData.discordEventId} was already deleted`);
            } else {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`Could not fetch Discord event ${pugData.discordEventId}:`, message);
            }
        }
    }

    switch (announcementType) {
        case 'scheduled':
            let message = `Hey ${roleMention}, a new PUG has been scheduled for <t:${timestamp}:F>. Mark your calendars!`;
            if (pugData.createdBy) {
                message += `\nScheduled by: <@${pugData.createdBy}>`;
            }
            if (eventUrl) {
                message += `\n\n${eventUrl}`;
            }
            return message;

        case 'reminder_24h':
            let reminder24h = `${roleMention} Scheduled PUG in 24 hours!\n`;
            reminder24h += `Time: <t:${timestamp}:F>\n`;
            if (eventUrl) {
                reminder24h += `Event: ${eventUrl}\n`;
            }
            return reminder24h;

        case 'reminder_1h':
            let reminder1h = `${roleMention} Scheduled PUG starting in 1 hour!\n`;
            reminder1h += `Time: <t:${timestamp}:F>\n`;
            if (eventUrl) {
                reminder1h += `Event: ${eventUrl}\n`;
            }
            reminder1h += `\nGet ready to join the main voice channel!`;
            return reminder1h;

        case 'cancelled':
            return `${roleMention} The scheduled PUG for <t:${timestamp}:F> has been cancelled.`;

        default:
            throw new Error(`Unknown announcement type: ${announcementType}`);
    }
}
