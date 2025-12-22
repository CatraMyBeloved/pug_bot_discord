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
            mu
                REAL
                NOT
                    NULL
                DEFAULT
                    25.0,
            sigma
                REAL
                NOT
                    NULL
                DEFAULT
                    8.333,
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
            guild_id                TEXT PRIMARY KEY,
            main_vc_id              TEXT,
            team1_vc_id             TEXT,
            team2_vc_id             TEXT,
            pug_role_id             TEXT,
            pug_leader_role_id      TEXT,
            announcement_channel_id TEXT,
            auto_move               INTEGER NOT NULL DEFAULT 1,
            fairness_weight         REAL NOT NULL DEFAULT 0.2,
            priority_weight         REAL NOT NULL DEFAULT 0.8,
            updated_at              DATETIME         DEFAULT CURRENT_TIMESTAMP
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

        CREATE TABLE IF NOT EXISTS button_interactions
        (
            interaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id       TEXT NOT NULL,
            user_id        TEXT NOT NULL,
            button_id      TEXT NOT NULL,
            action_type    TEXT NOT NULL,
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const playerColumns = db.pragma('table_info(players)') as Array<{ name: string }>;
    const hasMu = playerColumns.some(col => col.name === 'mu');

    if (!hasMu) {
        console.log('Migrating database: Adding TrueSkill columns...');
        db.prepare('ALTER TABLE players ADD COLUMN mu REAL DEFAULT 25.0').run();
        db.prepare('ALTER TABLE players ADD COLUMN sigma REAL DEFAULT 8.333').run();

        try {
            const {getSeedingParams} = require('../utils/trueskill');
            const players = db.prepare('SELECT discord_user_id, rank FROM players').all() as Array<{
                discord_user_id: string,
                rank: string
            }>;

            const updateStmt = db.prepare('UPDATE players SET mu = ?, sigma = ? WHERE discord_user_id = ?');

            const transaction = db.transaction(() => {
                for (const player of players) {
                    const {mu, sigma} = getSeedingParams(player.rank);
                    updateStmt.run(mu, sigma, player.discord_user_id);
                }
            });

            transaction();
            console.log(`Seeded TrueSkill ratings for ${players.length} existing players.`);
        } catch (e) {
            console.error('Failed to seed existing players during migration:', e);
        }
    }

    // Migration: Add matchmaking weight columns if not present
    const configColumns = db.pragma('table_info(guild_config)') as Array<{ name: string }>;
    const hasFairnessWeight = configColumns.some(col => col.name === 'fairness_weight');

    if (!hasFairnessWeight) {
        console.log('Migrating database: Adding matchmaking weight columns...');
        try {
            db.prepare('ALTER TABLE guild_config ADD COLUMN fairness_weight REAL NOT NULL DEFAULT 0.2').run();
            db.prepare('ALTER TABLE guild_config ADD COLUMN priority_weight REAL NOT NULL DEFAULT 0.8').run();
            console.log('Matchmaking weight columns added successfully.');
        } catch (e) {
            console.error('Failed to add matchmaking weight columns:', e);
        }
    }

    console.log('Database initialized');
    return db;
}