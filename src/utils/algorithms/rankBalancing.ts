import {BalancedTeams, RANK_VALUES, Role, SelectedPlayer, TEAM_COMPOSITION,} from '../../types/matchmaking';

/**
 * Track role counts for a team
 */
interface TeamState {
    players: SelectedPlayer[];
    totalRank: number;
    roleCounts: Record<Role, number>;
}

/**
 * Rank-based team balancing algorithm
 *
 * Balances two teams by distributing players to minimize rank difference
 * while maintaining role composition requirements (1 tank, 2 DPS, 2 support per team).
 *
 * Uses greedy assignment:
 * - Sort players by rank (descending)
 * - For each player, assign to team with lower total rank (if role slot available)
 * - If role is full on lower team, assign to other team
 *
 * @param players - 10 selected players with assigned roles
 * @returns Balanced teams
 */
export function balanceTeamsByRank(
    players: SelectedPlayer[]
): BalancedTeams {
    if (players.length !== 10) {
        throw new Error(
            `Expected exactly 10 players, got ${players.length}`
        );
    }

    const team1: TeamState = {
        players: [],
        totalRank: 0,
        roleCounts: {tank: 0, dps: 0, support: 0},
    };

    const team2: TeamState = {
        players: [],
        totalRank: 0,
        roleCounts: {tank: 0, dps: 0, support: 0},
    };

    const sortedPlayers = [...players].sort((a, b) => {
        const rankA = RANK_VALUES[a.rank];
        const rankB = RANK_VALUES[b.rank];
        return rankB - rankA;
    });

    /**
     * Check if a team can accept a player with the given role
     */
    function canAddToTeam(team: TeamState, role: Role): boolean {
        return team.roleCounts[role] < TEAM_COMPOSITION[role];
    }

    /**
     * Add a player to a team
     */
    function addToTeam(team: TeamState, player: SelectedPlayer): void {
        team.players.push(player);
        team.totalRank += RANK_VALUES[player.rank];
        team.roleCounts[player.assignedRole]++;
    }

    for (const player of sortedPlayers) {
        const role = player.assignedRole;

        const team1CanAdd = canAddToTeam(team1, role);
        const team2CanAdd = canAddToTeam(team2, role);

        if (team1CanAdd && team2CanAdd) {
            if (team1.totalRank <= team2.totalRank) {
                addToTeam(team1, player);
            } else {
                addToTeam(team2, player);
            }
        } else if (team1CanAdd) {
            addToTeam(team1, player);
        } else if (team2CanAdd) {
            addToTeam(team2, player);
        } else {
            throw new Error(
                `Cannot assign player with role ${role} to any team. This indicates a bug in player selection.`
            );
        }
    }

    return {
        team1: team1.players,
        team2: team2.players,
    };
}
