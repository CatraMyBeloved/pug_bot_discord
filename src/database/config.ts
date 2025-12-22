import Database from 'better-sqlite3';

export interface GuildConfig {
    guild_id: string;
    main_vc_id: string | null;
    team1_vc_id: string | null;
    team2_vc_id: string | null;
    pug_role_id: string | null;
    pug_leader_role_id: string | null;
    announcement_channel_id: string | null;
    auto_move: number;
    fairness_weight: number;
    priority_weight: number;
    updated_at: string;
}

export function getGuildConfig(
    db: Database.Database,
    guildId: string
): GuildConfig | undefined {
    const stmt = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?');
    return stmt.get(guildId) as GuildConfig | undefined;
}

export function setMainVC(
    db: Database.Database,
    guildId: string,
    channelId: string
): void {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, main_vc_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET main_vc_id = excluded.main_vc_id,
                                            updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(guildId, channelId);
}

export function setTeam1VC(
    db: Database.Database,
    guildId: string,
    channelId: string
): void {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, team1_vc_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET team1_vc_id = excluded.team1_vc_id,
                                            updated_at  = CURRENT_TIMESTAMP
    `);
    stmt.run(guildId, channelId);
}

export function setTeam2VC(
    db: Database.Database,
    guildId: string,
    channelId: string
): void {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, team2_vc_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET team2_vc_id = excluded.team2_vc_id,
                                            updated_at  = CURRENT_TIMESTAMP
    `);
    stmt.run(guildId, channelId);
}

export function setAutoMove(
    db: Database.Database,
    guildId: string,
    enabled: boolean
): void {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, auto_move)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET auto_move  = excluded.auto_move,
                                            updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(guildId, enabled ? 1 : 0);
}

export function setPugRole(
    db: Database.Database,
    guildId: string,
    roleId: string
): void {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, pug_role_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET pug_role_id = excluded.pug_role_id,
                                            updated_at   = CURRENT_TIMESTAMP
    `);
    stmt.run(guildId, roleId);
}

export function setAnnouncementChannel(
    db: Database.Database,
    guildId: string,
    channelId: string
): void {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, announcement_channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET announcement_channel_id = excluded.announcement_channel_id,
                                            updated_at              = CURRENT_TIMESTAMP
    `);
    stmt.run(guildId, channelId);
}

export function setPugLeaderRole(
    db: Database.Database,
    guildId: string,
    roleId: string
): void {
    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, pug_leader_role_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET pug_leader_role_id = excluded.pug_leader_role_id,
                                            updated_at         = CURRENT_TIMESTAMP
    `);
    stmt.run(guildId, roleId);
}

export function getPugLeaderRoles(
    db: Database.Database,
    guildId: string
): string[] {
    const stmt = db.prepare('SELECT role_id FROM guild_pug_leader_roles WHERE guild_id = ?');
    const rows = stmt.all(guildId) as { role_id: string }[];
    return rows.map(r => r.role_id);
}

export function addPugLeaderRole(
    db: Database.Database,
    guildId: string,
    roleId: string
): boolean {
    const stmt = db.prepare(`
        INSERT INTO guild_pug_leader_roles (guild_id, role_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id, role_id) DO NOTHING
    `);
    const result = stmt.run(guildId, roleId);
    return result.changes > 0;
}

export function removePugLeaderRole(
    db: Database.Database,
    guildId: string,
    roleId: string
): boolean {
    const stmt = db.prepare('DELETE FROM guild_pug_leader_roles WHERE guild_id = ? AND role_id = ?');
    const result = stmt.run(guildId, roleId);
    return result.changes > 0;
}

export interface MatchmakingWeights {
    fairnessWeight: number;
    priorityWeight: number;
}

export interface WeightValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate matchmaking weights
 * Rules:
 * - Both must be numbers
 * - Both must be >= 0 and <= 1
 * - Sum must equal 1.0 (tolerance: ±0.001)
 */
export function validateMatchmakingWeights(
    fairnessWeight: number,
    priorityWeight: number
): WeightValidationResult {
    const errors: string[] = [];

    if (typeof fairnessWeight !== 'number' || isNaN(fairnessWeight)) {
        errors.push('Fairness weight must be a valid number');
    }
    if (typeof priorityWeight !== 'number' || isNaN(priorityWeight)) {
        errors.push('Priority weight must be a valid number');
    }
    if (fairnessWeight < 0 || fairnessWeight > 1) {
        errors.push('Fairness weight must be between 0 and 1');
    }
    if (priorityWeight < 0 || priorityWeight > 1) {
        errors.push('Priority weight must be between 0 and 1');
    }

    const sum = fairnessWeight + priorityWeight;
    if (Math.abs(sum - 1.0) > 0.001) {
        errors.push(`Weights must sum to 1.0 (current sum: ${sum.toFixed(3)})`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Get matchmaking weights for a guild, with fallback to defaults
 * @param db - Database instance
 * @param guildId - Guild ID
 * @returns Matchmaking weights (defaults: 0.2 fairness, 0.8 priority)
 */
export function getMatchmakingWeights(
    db: Database.Database,
    guildId: string
): MatchmakingWeights {
    const config = getGuildConfig(db, guildId);

    if (!config) {
        return { fairnessWeight: 0.2, priorityWeight: 0.8 };
    }

    return {
        fairnessWeight: config.fairness_weight ?? 0.2,
        priorityWeight: config.priority_weight ?? 0.8
    };
}

/**
 * Set matchmaking weights for a guild
 * @param db - Database instance
 * @param guildId - Guild ID
 * @param fairnessWeight - Weight for fairness cost (0-1)
 * @param priorityWeight - Weight for priority cost (0-1)
 * @throws Error if validation fails
 */
export function setMatchmakingWeights(
    db: Database.Database,
    guildId: string,
    fairnessWeight: number,
    priorityWeight: number
): void {
    const validation = validateMatchmakingWeights(fairnessWeight, priorityWeight);

    if (!validation.valid) {
        throw new Error(`Invalid matchmaking weights: ${validation.errors.join(', ')}`);
    }

    const stmt = db.prepare(`
        INSERT INTO guild_config (guild_id, fairness_weight, priority_weight)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
            fairness_weight = excluded.fairness_weight,
            priority_weight = excluded.priority_weight,
            updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(guildId, fairnessWeight, priorityWeight);
}