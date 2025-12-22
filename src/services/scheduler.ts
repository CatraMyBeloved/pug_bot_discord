import {Client} from 'discord.js';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import {getPugsNeedingReminders, markReminderSent, updatePugState, ScheduledPug} from '../database/scheduled_pugs';
import {getGuildConfig} from '../database/config';
import {sendPugAnnouncement} from '../utils/announcements';

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
    pug: ScheduledPug,
    reminderType: '24h' | '1h'
): Promise<void> {
    const announcementType = reminderType === '24h' ? 'reminder_24h' : 'reminder_1h';
    await sendPugAnnouncement(
        client,
        db,
        pug.guild_id,
        announcementType,
        {
            pugId: pug.pug_id,
            scheduledTime: new Date(pug.scheduled_time),
            discordEventId: pug.discord_event_id
        }
    );
}
