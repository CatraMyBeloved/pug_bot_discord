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
            role
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
                    'active',
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

        CREATE INDEX IF NOT EXISTS idx_players_role ON players (role);
        CREATE INDEX IF NOT EXISTS idx_matches_state ON matches (state);
    `);

    console.log('Database initialized');
    return db;
}