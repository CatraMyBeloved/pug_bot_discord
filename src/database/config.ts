import Database from 'better-sqlite3';

export interface GuildConfig {
    guild_id: string;
    main_vc_id: string | null;
    team1_vc_id: string | null;
    team2_vc_id: string | null;
    pug_role_id: string | null;
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