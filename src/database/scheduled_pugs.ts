import Database from 'better-sqlite3';

export interface ScheduledPug {
    pug_id: number;
    guild_id: string;
    scheduled_time: string;
    created_by: string;
    discord_event_id: string | null;
    state: string;
    reminder_24h_sent: number;
    reminder_1h_sent: number;
    created_at: string;
}

export function createScheduledPug(
    db: Database.Database,
    guildId: string,
    scheduledTime: string,
    createdBy: string,
    discordEventId: string | null
): number {
    const stmt = db.prepare(`
        INSERT INTO scheduled_pugs (guild_id, scheduled_time, created_by, discord_event_id)
        VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(guildId, scheduledTime, createdBy, discordEventId);
    return result.lastInsertRowid as number;
}

export function getScheduledPug(
    db: Database.Database,
    pugId: number
): ScheduledPug | undefined {
    const stmt = db.prepare('SELECT * FROM scheduled_pugs WHERE pug_id = ?');
    return stmt.get(pugId) as ScheduledPug | undefined;
}

export function getUpcomingPugs(
    db: Database.Database,
    guildId: string
): ScheduledPug[] {
    const stmt = db.prepare(`
        SELECT *
        FROM scheduled_pugs
        WHERE guild_id = ?
          AND state = 'pending'
        ORDER BY scheduled_time
    `);
    return stmt.all(guildId) as ScheduledPug[];
}

export function getPugsNeedingReminders(
    db: Database.Database
): ScheduledPug[] {
    const stmt = db.prepare(`
        SELECT *
        FROM scheduled_pugs
        WHERE state = 'pending'
          AND scheduled_time > datetime('now')
    `);
    return stmt.all() as ScheduledPug[];
}

export function markReminderSent(
    db: Database.Database,
    pugId: number,
    reminderType: '24h' | '1h'
): void {
    const column = reminderType === '24h' ? 'reminder_24h_sent' : 'reminder_1h_sent';
    const stmt = db.prepare(`
        UPDATE scheduled_pugs
        SET ${column} = 1
        WHERE pug_id = ?
    `);
    stmt.run(pugId);
}

export function updatePugState(
    db: Database.Database,
    pugId: number,
    newState: string
): void {
    const stmt = db.prepare(`
        UPDATE scheduled_pugs
        SET state = ?
        WHERE pug_id = ?
    `);
    stmt.run(newState, pugId);
}

export function cancelScheduledPug(
    db: Database.Database,
    pugId: number
): void {
    updatePugState(db, pugId, 'cancelled');
}
