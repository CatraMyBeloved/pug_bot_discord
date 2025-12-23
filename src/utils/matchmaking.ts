import Database from 'better-sqlite3';
import {getPlayer} from '../database/players';
import {getLastPlayed} from '../database/matches';
import {getMatchmakingWeights} from '../database/config';
import {BalancedTeams, PlayerWithRoles, Rank, Role, OptimizerConfig, DEFAULT_OPTIMIZER_CONFIG} from '../types/matchmaking';

import {selectPlayersByPriority} from './algorithms/prioritySelection';
import {balanceTeamsBySkill} from './algorithms/rankBalancing';
import {optimizeMatchSelection} from './algorithms/matchOptimizer';

const USE_MATCHMAKING_V2 = true;

/**
 * Create balanced teams from players in voice channel
 *
 * This orchestrator:
 * 1. Filters to registered players
 * 2. Builds priority calculator based on last played time (any match)
 * 3. Calls player selection algorithm (swappable)
 * 4. Calls team balancing algorithm (swappable)
 *
 * @param userIds - Discord user IDs of players in voice channel
 * @param db - Database connection
 * @param guildId - Guild ID for fetching guild-specific config
 * @returns Balanced teams with 5 players each
 */
export function createMatchTeams(
    userIds: string[],
    db: Database.Database,
    guildId: string
): BalancedTeams {
    const playersInVc: PlayerWithRoles[] = [];

    for (const userId of userIds) {
        const player = getPlayer(db, userId);
        if (player && player.roles) {
            playersInVc.push({
                userId: player.discord_user_id,
                battlenetId: player.battlenet_id,
                availableRoles: player.roles as Role[],
                rank: player.rank as Rank,
                mu: player.mu,
            });
        }
    }

    const getPriorityScore = (userId: string, role: Role): number => {
        const lastPlayed = getLastPlayed(db, userId);

        if (!lastPlayed) {
            return Infinity;
        }

        const lastPlayedDate = new Date(lastPlayed);
        const now = new Date();
        const daysSince =
            (now.getTime() - lastPlayedDate.getTime()) / (1000 * 60 * 60 * 24);

        return daysSince;
    };

    // Fetch guild-specific matchmaking weights
    const weights = getMatchmakingWeights(db, guildId);

    // Log if using default weights (helpful for debugging)
    const guildConfig = db.prepare('SELECT fairness_weight FROM guild_config WHERE guild_id = ?').get(guildId) as { fairness_weight: number | null } | undefined;
    if (!guildConfig || guildConfig.fairness_weight === null) {
        console.log(`[Matchmaking] Guild ${guildId}: Using default weights (fairness: ${weights.fairnessWeight}, priority: ${weights.priorityWeight})`);
    }

    // Build config with guild weights
    const config: OptimizerConfig = {
        ...DEFAULT_OPTIMIZER_CONFIG,
        fairnessWeight: weights.fairnessWeight,
        priorityWeight: weights.priorityWeight
    };

    // Feature flag: Use V2 optimizer or V1 priority selection
    let selectedPlayers;
    if (USE_MATCHMAKING_V2) {
        selectedPlayers = optimizeMatchSelection(playersInVc, getPriorityScore, config);
        return balanceTeamsBySkill(selectedPlayers);
    } else {
        selectedPlayers = selectPlayersByPriority(playersInVc, getPriorityScore);
        return balanceTeamsBySkill(selectedPlayers);
    }
}
