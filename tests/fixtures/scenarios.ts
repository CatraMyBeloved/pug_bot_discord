import Database from 'better-sqlite3';
import { registerPlayer } from '../../src/database/players';
import { createMatch, completeMatch } from '../../src/database/matches';
import { Rank, Role } from '../../src/types/matchmaking';

/**
 * Counter for generating unique user IDs to avoid conflicts
 */
let seedPlayerCounter = 0;

/**
 * Resets the seed player counter (useful for independent tests)
 */
export function resetSeedPlayerCounter(): void {
    seedPlayerCounter = 0;
}

/**
 * Seeds database with a set of registered players
 * Returns array of user IDs
 *
 * Note: Uses a global counter to generate unique user IDs.
 * This prevents conflicts when calling seedPlayers multiple times in a single test.
 */
export function seedPlayers(
    db: Database.Database,
    count: number,
    roles: Role[] = ['tank', 'dps', 'support'],
    rank: Rank = 'gold'
): string[] {
    const userIds: string[] = [];

    for (let i = 1; i <= count; i++) {
        seedPlayerCounter++;
        const userId = `user${seedPlayerCounter}`;
        const battlenetId = `Player${seedPlayerCounter}#1234`;
        registerPlayer(db, userId, battlenetId, roles, rank);
        userIds.push(userId);
    }

    return userIds;
}

/**
 * Seeds database with players at different last played times
 * Returns user IDs sorted by priority (never played first, then by oldest match)
 */
export function seedPlayersWithMatchHistory(
    db: Database.Database,
    vcChannelId: string = 'vc123'
): string[] {
    const userIds = seedPlayers(db, 12, ['tank', 'dps', 'support'], 'gold');

    // Create completed match with users 1-10 (played 10 days ago)
    // Users 11-12: never played
    const oldMatchParticipants = userIds.slice(0, 10).map((userId, i) => ({
        userId,
        team: i < 5 ? 1 : 2,
        assignedRole: 'dps' as Role,
    }));

    const matchId = createMatch(db, vcChannelId, oldMatchParticipants);

    // Manually set created_at to 10 days ago and mark as complete
    db.prepare(`
        UPDATE matches
        SET created_at   = datetime('now', '-10 days'),
            state        = 'complete',
            completed_at = datetime('now', '-10 days')
        WHERE match_id = ?
    `).run(matchId);

    completeMatch(db, matchId, 1);

    // Return in priority order: users 11-12 (never played), then 1-10 (played 10 days ago)
    return [...userIds.slice(10), ...userIds.slice(0, 10)];
}

/**
 * Seeds guild configuration
 */
export function seedGuildConfig(
    db: Database.Database,
    guildId: string = 'guild123',
    mainVcId: string = 'vc123'
): void {
    db.prepare(`
        INSERT INTO guild_config (guild_id, main_vc_id, auto_move)
        VALUES (?, ?, 1)
    `).run(guildId, mainVcId);
}
