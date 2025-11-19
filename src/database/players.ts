import Database from 'better-sqlite3';

export interface Player {
    discord_user_id: string;
    battlenet_id: string;
    rank: string;
    wins: number;
    losses: number;
    registered_at: string;
    roles?: string[];
}

export function registerPlayer(
    db: Database.Database,
    discordUserId: string,
    battlenetId: string,
    roles: string[],
    rank: string
): void {
    const playerStmt = db.prepare(`
        INSERT INTO players (discord_user_id, battlenet_id, rank)
        VALUES (?, ?, ?)
    `);
    playerStmt.run(discordUserId, battlenetId, rank);

    const roleStmt = db.prepare(`
        INSERT INTO player_roles (discord_user_id, role)
        VALUES (?, ?)
    `);

    for (const role of roles) {
        roleStmt.run(discordUserId, role);
    }
}

export function getPlayer(
    db: Database.Database,
    discordUserId: string
): Player | undefined {
    const stmt = db.prepare('SELECT * FROM players WHERE discord_user_id = ?');
    const player = stmt.get(discordUserId) as Player | undefined;

    if (player) {
        const rolesStmt = db.prepare('SELECT role FROM player_roles WHERE discord_user_id = ?');
        const roleRows = rolesStmt.all(discordUserId) as { role: string }[];
        player.roles = roleRows.map(r => r.role);
    }

    return player;
}

export function getPlayerRoles(
    db: Database.Database,
    discordUserId: string
): string[] {
    const stmt = db.prepare('SELECT role FROM player_roles WHERE discord_user_id = ?');
    const rows = stmt.all(discordUserId) as { role: string }[];
    return rows.map(r => r.role);
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
    roles?: string[],
    rank?: string
): void {
    const updates: string[] = [];
    const values: string[] = [];

    if (battlenetId !== undefined) {
        updates.push('battlenet_id = ?');
        values.push(battlenetId);
    }
    if (rank !== undefined) {
        updates.push('rank = ?');
        values.push(rank);
    }

    if (updates.length > 0) {
        values.push(discordUserId);
        const stmt = db.prepare(`
            UPDATE players
            SET ${updates.join(', ')}
            WHERE discord_user_id = ?
        `);
        stmt.run(...values);
    }

    if (roles !== undefined && roles.length > 0) {
        const deleteStmt = db.prepare('DELETE FROM player_roles WHERE discord_user_id = ?');
        deleteStmt.run(discordUserId);

        const insertStmt = db.prepare(`
            INSERT INTO player_roles (discord_user_id, role)
            VALUES (?, ?)
        `);

        for (const role of roles) {
            insertStmt.run(discordUserId, role);
        }
    }
}