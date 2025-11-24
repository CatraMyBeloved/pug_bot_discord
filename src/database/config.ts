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