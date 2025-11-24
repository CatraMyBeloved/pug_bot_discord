import {Client} from 'discord.js';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import {getPugsNeedingReminders, markReminderSent, updatePugState} from '../database/scheduled_pugs';
import {getGuildConfig} from '../database/config';

export function initializeScheduler(client: Client, db: Database.Database): void {
    console.log('Initializing PUG scheduler...');

    cron.schedule('*/5 * * * *', () => {
        checkAndSendReminders(client, db);
    });

    checkAndSendReminders(client, db);

    console.log('PUG scheduler initialized');
}

async function checkAndSendReminders(client: Client, db: Database.Database): Promise<void> {
    try {
        const pugs = getPugsNeedingReminders(db);
        const now = new Date();

        for (const pug of pugs) {
            const scheduledTime = new Date(pug.scheduled_time);
            const hoursUntil = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

            if (hoursUntil < 0) {
                updatePugState(db, pug.pug_id, 'completed');
                continue;
            }

            if (!pug.reminder_24h_sent && hoursUntil >= 22 && hoursUntil <= 26) {
                await sendReminder(client, db, pug, '24h');
                markReminderSent(db, pug.pug_id, '24h');
            }

            if (!pug.reminder_1h_sent && hoursUntil >= 0.916 && hoursUntil <= 1.083) {
                await sendReminder(client, db, pug, '1h');
                markReminderSent(db, pug.pug_id, '1h');
            }
        }
    } catch (error) {
        console.error('Error in checkAndSendReminders:', error);
    }
}

async function sendReminder(
    client: Client,
    db: Database.Database,
    pug: any,
    reminderType: '24h' | '1h'
): Promise<void> {
    try {
        const config = getGuildConfig(db, pug.guild_id);

        if (!config || !config.announcement_channel_id) {
            console.warn(`No announcement channel configured for guild ${pug.guild_id}`);
            return;
        }

        const channel = await client.channels.fetch(config.announcement_channel_id);

        if (!channel || !channel.isTextBased()) {
            console.warn(`Invalid announcement channel for guild ${pug.guild_id}`);
            return;
        }

        const timestamp = Math.floor(new Date(pug.scheduled_time).getTime() / 1000);
        const roleMention = config.pug_role_id ? `<@&${config.pug_role_id}>` : '**PUG Reminder:**';

        let message: string;
        if (reminderType === '24h') {
            message = `${roleMention} Scheduled PUG in 24 hours!\n`;
        } else {
            message = `${roleMention} Scheduled PUG starting in 1 hour!\n`;
        }

        message += `Time: <t:${timestamp}:F>\n`;

        if (pug.discord_event_id) {
            try {
                const guild = await client.guilds.fetch(pug.guild_id);
                const event = await guild.scheduledEvents.fetch(pug.discord_event_id);
                // @ts-ignore
                message += `Event: ${event.url}\n`;
            } catch (error) {
                console.warn(`Could not fetch Discord event ${pug.discord_event_id}`);
            }
        }

        if (reminderType === '1h') {
            message += `\nGet ready to join the main voice channel!`;
        }

        if ("send" in channel) {
            await channel.send(message);
        }
        console.log(`Sent ${reminderType} reminder for PUG ${pug.pug_id} in guild ${pug.guild_id}`);
    } catch (error) {
        console.error(`Error sending reminder for PUG ${pug.pug_id}:`, error);
    }
}
