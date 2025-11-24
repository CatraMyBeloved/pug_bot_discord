import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/bot.db');

export function initDatabase(): Database.Database {
    const fs = require('fs');
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, {recursive: true});
    }

    const db = new Database(DB_PATH);

    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS players
        (
            discord_user_id
                TEXT
                PRIMARY
                    KEY,
            battlenet_id
                TEXT
                NOT
                    NULL,
            rank
                TEXT
                NOT
                    NULL,
            wins
                INTEGER
                NOT
                    NULL
                DEFAULT
                    0,
            losses
                INTEGER
                NOT
                    NULL
                DEFAULT
                    0,
            registered_at
                DATETIME
                DEFAULT
                    CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS player_roles
        (
            discord_user_id
                TEXT
                NOT
                    NULL,
            role
                TEXT
                NOT
                    NULL,
            PRIMARY
                KEY
                (
                 discord_user_id,
                 role
                    ),
            FOREIGN KEY
                (
                 discord_user_id
                    ) REFERENCES players
                (
                 discord_user_id
                    )
                    ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS matches
        (
            match_id
                INTEGER
                PRIMARY
                    KEY
                AUTOINCREMENT,
            state
                TEXT
                NOT
                    NULL
                DEFAULT
                    'prepared',
            created_at
                DATETIME
                DEFAULT
                    CURRENT_TIMESTAMP,
            completed_at
                DATETIME,
            winning_team
                INTEGER,
            voice_channel_id
                TEXT
        );
        CREATE TABLE IF NOT EXISTS guild_config
        (
            guild_id    TEXT PRIMARY KEY,
            main_vc_id  TEXT,
            team1_vc_id TEXT,
            team2_vc_id TEXT,
            pug_role_id TEXT,
            auto_move   INTEGER NOT NULL DEFAULT 1,
            updated_at  DATETIME         DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS match_participants
        (
            match_id
                INTEGER
                NOT
                    NULL,
            discord_user_id
                TEXT
                NOT
                    NULL,
            team
                INTEGER
                NOT
                    NULL,
            assigned_role
                TEXT
                NOT
                    NULL,
            PRIMARY
                KEY
                (
                 match_id,
                 discord_user_id
                    ),
            FOREIGN KEY
                (
                 match_id
                    ) REFERENCES matches
                (
                 match_id
                    ),
            FOREIGN KEY
                (
                 discord_user_id
                    ) REFERENCES players
                (
                 discord_user_id
                    )
        );

        CREATE INDEX IF NOT EXISTS idx_player_roles_role ON player_roles (role);
        CREATE INDEX IF NOT EXISTS idx_matches_state ON matches (state);

        CREATE TABLE IF NOT EXISTS scheduled_pugs
        (
            pug_id            INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id          TEXT     NOT NULL,
            scheduled_time    DATETIME NOT NULL,
            created_by        TEXT     NOT NULL,
            discord_event_id  TEXT,
            state             TEXT              DEFAULT 'pending',
            reminder_24h_sent INTEGER  NOT NULL DEFAULT 0,
            reminder_1h_sent  INTEGER  NOT NULL DEFAULT 0,
            created_at        DATETIME          DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_scheduled_pugs_guild_time_state
            ON scheduled_pugs (guild_id, scheduled_time, state);

        CREATE TABLE IF NOT EXISTS guild_pug_leader_roles
        (
            guild_id TEXT NOT NULL,
            role_id  TEXT NOT NULL,
            PRIMARY KEY (guild_id, role_id)
        );
    `);

    try {
        db.exec(`ALTER TABLE guild_config
            ADD COLUMN announcement_channel_id TEXT`);
    } catch (error) {
    }

    try {
        db.exec(`ALTER TABLE guild_config
            ADD COLUMN pug_leader_role_id TEXT`);
    } catch (error) {
    }

    console.log('Database initialized');
    return db;
}