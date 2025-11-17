import Database from 'better-sqlite3';

export interface Player {
    discord_user_id: string;
    battlenet_id: string;
    role: string;
    rank: string;
    wins: number;
    losses: number;
    registered_at: string;
}

export function registerPlayer(
    db: Database.Database,
    discordUserId: string,
    battlenetId: string,
    role: string,
    rank: string
): void {
    const stmt = db.prepare(`
        INSERT INTO players (discord_user_id, battlenet_id, role, rank)
        VALUES (?, ?, ?, ?)
    `);

    stmt.run(discordUserId, battlenetId, role, rank);
}

export function getPlayer(
    db: Database.Database,
    discordUserId: string
): Player | undefined {
    const stmt = db.prepare('SELECT * FROM players WHERE discord_user_id = ?');
    return stmt.get(discordUserId) as Player | undefined;
}

export function isPlayerRegistered(
    db: Database.Database,
    discordUserId: string
): boolean {
    return getPlayer(db, discordUserId) !== undefined;
}

export function updatePlayer(
    db: Database.Database,
    discordUserId: string,
    battlenetId?: string,
    role?: string,
    rank?: string
): void {
    const updates: string[] = [];
    const values: string[] = [];

    if (battlenetId !== undefined) {
        updates.push('battlenet_id = ?');
        values.push(battlenetId);
    }
    if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
    }
    if (rank !== undefined) {
        updates.push('rank = ?');
        values.push(rank);
    }

    if (updates.length === 0) {
        return;
    }

    values.push(discordUserId);

    const stmt = db.prepare(`
        UPDATE players
        SET ${updates.join(', ')}
        WHERE discord_user_id = ?
    `);

    stmt.run(...values);
}