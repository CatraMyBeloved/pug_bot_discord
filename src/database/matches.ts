import Database from 'better-sqlite3';

export interface Match {
    match_id: number;
    state: 'prepared' | 'active' | 'complete' | 'cancelled';
    created_at: string;
    completed_at: string | null;
    winning_team: number | null;
    voice_channel_id: string | null;
}

export interface MatchParticipant {
    match_id: number;
    discord_user_id: string;
    team: number;
    assigned_role: string;
}

export interface ParticipantWithDetails extends MatchParticipant {
    battlenet_id: string;
    rank: string;
}

/**
 * Get the current prepared or active match for a guild
 */
export function getCurrentMatch(
    db: Database.Database,
    guildId: string
): Match | undefined {
    const stmt = db.prepare(`
        SELECT m.*
        FROM matches m
                 JOIN guild_config gc ON m.voice_channel_id = gc.main_vc_id
        WHERE gc.guild_id = ?
          AND m.state IN ('prepared', 'active')
        ORDER BY m.created_at DESC
        LIMIT 1
    `);
    return stmt.get(guildId) as Match | undefined;
}

/**
 * Create a new match with participants
 */
export function createMatch(
    db: Database.Database,
    voiceChannelId: string,
    participants: Array<{
        userId: string;
        team: number;
        assignedRole: string;
    }>
): number {
    const insertMatch = db.prepare(`
        INSERT INTO matches (state, voice_channel_id)
        VALUES ('prepared', ?)
    `);

    const insertParticipant = db.prepare(`
        INSERT INTO match_participants (match_id, discord_user_id, team, assigned_role)
        VALUES (?, ?, ?, ?)
    `);

    const info = insertMatch.run(voiceChannelId);
    const matchId = info.lastInsertRowid as number;

    for (const participant of participants) {
        insertParticipant.run(
            matchId,
            participant.userId,
            participant.team,
            participant.assignedRole
        );
    }

    return matchId;
}

/**
 * Update match state to 'active'
 */
export function startMatch(db: Database.Database, matchId: number): void {
    const stmt = db.prepare(`
        UPDATE matches
        SET state = 'active'
        WHERE match_id = ?
    `);
    stmt.run(matchId);
}

/**
 * Update match state to 'cancelled'
 */
export function cancelMatch(db: Database.Database, matchId: number): void {
    const stmt = db.prepare(`
        UPDATE matches
        SET state        = 'cancelled',
            completed_at = CURRENT_TIMESTAMP
        WHERE match_id = ?
    `);
    stmt.run(matchId);
}

/**
 * Mark match as complete with winning team
 */
export function completeMatch(
    db: Database.Database,
    matchId: number,
    winningTeam: number | null
): void {
    const stmt = db.prepare(`
        UPDATE matches
        SET state        = 'complete',
            winning_team = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE match_id = ?
    `);
    stmt.run(winningTeam, matchId);
}

/**
 * Get all participants for a match with player details
 */
export function getMatchParticipants(
    db: Database.Database,
    matchId: number
): ParticipantWithDetails[] {
    const stmt = db.prepare(`
        SELECT mp.match_id,
               mp.discord_user_id,
               mp.team,
               mp.assigned_role,
               p.battlenet_id,
               p.rank
        FROM match_participants mp
                 JOIN players p ON mp.discord_user_id = p.discord_user_id
        WHERE mp.match_id = ?
        ORDER BY mp.team, mp.assigned_role
    `);
    return stmt.all(matchId) as ParticipantWithDetails[];
}

/**
 * Get the last time a player played a specific role (for priority calculation)
 */
export function getLastPlayedForRole(
    db: Database.Database,
    userId: string,
    role: string
): string | null {
    const stmt = db.prepare(`
        SELECT MAX(m.created_at) as last_played_at
        FROM match_participants mp
                 JOIN matches m ON mp.match_id = m.match_id
        WHERE m.state = 'complete'
          AND mp.discord_user_id = ?
          AND mp.assigned_role = ?
    `);
    const result = stmt.get(userId, role) as { last_played_at: string | null };
    return result.last_played_at;
}

/**
 * Get the last time a player played any match (regardless of role)
 */
export function getLastPlayed(
    db: Database.Database,
    userId: string
): string | null {
    const stmt = db.prepare(`
        SELECT MAX(m.created_at) as last_played_at
        FROM match_participants mp
                 JOIN matches m ON mp.match_id = m.match_id
        WHERE m.state = 'complete'
          AND mp.discord_user_id = ?
    `);
    const result = stmt.get(userId) as { last_played_at: string | null };
    return result.last_played_at;
}
