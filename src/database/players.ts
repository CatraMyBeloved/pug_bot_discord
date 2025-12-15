import Database from 'better-sqlite3';
import {getSeedingParams} from '../utils/trueskill';

export interface Player {
    discord_user_id: string;
    battlenet_id: string;
    rank: string;
    wins: number;
    losses: number;
    mu: number;
    sigma: number;
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
    const {mu, sigma} = getSeedingParams(rank);
    const playerStmt = db.prepare(`
        INSERT INTO players (discord_user_id, battlenet_id, rank, mu, sigma)
        VALUES (?, ?, ?, ?, ?)
    `);
    playerStmt.run(discordUserId, battlenetId, rank, mu, sigma);

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

export interface RecentMatch {
    matchId: number;
    team: number;
    assignedRole: string;
    wonMatch: boolean;
    completedAt: string;
    isDraw: boolean;
}

export interface PlayerStats {
    player: Player;
    totalGames: number;
    winRate: number;
    roleStats: {
        tank: number;
        dps: number;
        support: number;
    };
    recentMatches: RecentMatch[];
}

/**
 * Get detailed player statistics including role breakdown and recent matches
 */
export function getPlayerStats(
    db: Database.Database,
    discordUserId: string,
    recentMatchLimit: number = 10
): PlayerStats | undefined {
    const player = getPlayer(db, discordUserId);
    if (!player) return undefined;

    const totalGames = player.wins + player.losses;
    const winRate = totalGames > 0 ? (player.wins / totalGames) * 100 : 0;

    // Get role breakdown
    const roleStatsQuery = db.prepare(`
        SELECT assigned_role, COUNT(*) as count
        FROM match_participants mp
                 JOIN matches m ON mp.match_id = m.match_id
        WHERE mp.discord_user_id = ?
          AND m.state = 'complete'
        GROUP BY assigned_role
    `);
    const roleRows = roleStatsQuery.all(discordUserId) as Array<{ assigned_role: string, count: number }>;

    const roleStats = {
        tank: roleRows.find(r => r.assigned_role === 'tank')?.count || 0,
        dps: roleRows.find(r => r.assigned_role === 'dps')?.count || 0,
        support: roleRows.find(r => r.assigned_role === 'support')?.count || 0
    };

    // Get recent matches
    const recentMatchesQuery = db.prepare(`
        SELECT m.match_id,
               mp.team,
               mp.assigned_role,
               m.winning_team,
               m.completed_at
        FROM match_participants mp
                 JOIN matches m ON mp.match_id = m.match_id
        WHERE mp.discord_user_id = ?
          AND m.state = 'complete'
        ORDER BY m.completed_at DESC
        LIMIT ?
    `);

    const recentRows = recentMatchesQuery.all(discordUserId, recentMatchLimit) as Array<{
        match_id: number,
        team: number,
        assigned_role: string,
        winning_team: number | null,
        completed_at: string
    }>;

    const recentMatches: RecentMatch[] = recentRows.map(row => ({
        matchId: row.match_id,
        team: row.team,
        assignedRole: row.assigned_role,
        wonMatch: row.winning_team === row.team,
        completedAt: row.completed_at,
        isDraw: row.winning_team === null
    }));

    return {
        player,
        totalGames,
        winRate,
        roleStats,
        recentMatches
    };
}

export interface LeaderboardEntry {
    discordUserId: string;
    battlenetId: string;
    rank: string;
    wins: number;
    losses: number;
    totalGames: number;
    winRate: number;
    score: number;
    mu: number;
    sigma: number;
    sr: number;
}

/**
 * Get leaderboard sorted by Skill Rating (SR)
 * SR = (mu - 3 * sigma) * 100
 */
export function getLeaderboard(
    db: Database.Database,
    limit: number = 25,
    minGames: number = 3
): LeaderboardEntry[] {
    const query = db.prepare(`
        SELECT discord_user_id,
               battlenet_id,
               rank,
               wins,
               losses,
               mu,
               sigma,
               MAX(0, ROUND((mu - 3 * sigma) * 100))                            as sr,
               (wins + losses)                                                  as total_games,
               CASE
                   WHEN (wins + losses) > 0
                       THEN CAST(wins AS REAL) / (wins + losses) * 100.0
                   ELSE 0.0
                   END                                                          as win_rate
        FROM players
        WHERE (wins + losses) >= ?
        ORDER BY sr DESC, total_games DESC
        LIMIT ?
    `);

    return query.all(minGames, limit) as LeaderboardEntry[];
}