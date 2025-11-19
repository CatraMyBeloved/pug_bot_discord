import Database from 'better-sqlite3';
import {getPlayer} from '../database/players';
import {getLastPlayed} from '../database/matches';
import {BalancedTeams, PlayerWithRoles, Rank, Role,} from '../types/matchmaking';

import {selectPlayersByPriority} from './algorithms/prioritySelection';
import {balanceTeamsByRank} from './algorithms/rankBalancing';

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
 * @returns Balanced teams with 5 players each
 */
export function createMatchTeams(
    userIds: string[],
    db: Database.Database
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


    const selectedPlayers = selectPlayersByPriority(
        playersInVc,
        getPriorityScore
    );

    const balancedTeams = balanceTeamsByRank(selectedPlayers);

    return balancedTeams;
}
