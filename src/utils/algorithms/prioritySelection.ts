import {PlayerWithRoles, Role, SelectedPlayer, TEAM_COMPOSITION,} from '../../types/matchmaking';

/**
 * Error thrown when there aren't enough players to form teams
 */
export class InsufficientPlayersError extends Error {
    constructor(
        public required: number,
        public found: number
    ) {
        super(`Not enough players in voice channel. Need ${required}+, found ${found}.`);
        this.name = 'InsufficientPlayersError';
    }
}

/**
 * Error thrown when role composition can't be satisfied
 */
export class InsufficientRoleCompositionError extends Error {
    constructor(
        public required: { tank: number; dps: number; support: number },
        public found: { tank: number; dps: number; support: number }
    ) {
        super(
            `Can't make balanced teams. Need ${required.tank}+ tanks, ${required.dps}+ DPS, ${required.support}+ support. ` +
            `Currently: ${found.tank} tanks, ${found.dps} DPS, ${found.support} support.`
        );
        this.name = 'InsufficientRoleCompositionError';
    }
}

/**
 * Priority-based player selection algorithm
 *
 * Selects 10 players from the available pool based on priority scores (time since last match).
 * Selection order prioritizes scarce roles: tanks → supports → DPS.
 *
 * @param players - Available players with their roles
 * @param getPriorityScore - Function to get priority score for a user/role (higher = higher priority)
 * @returns 10 selected players with assigned roles
 * @throws {InsufficientPlayersError} If fewer than 10 players available
 * @throws {InsufficientRoleCompositionError} If role composition can't be satisfied
 */
export function selectPlayersByPriority(
    players: PlayerWithRoles[],
    getPriorityScore: (userId: string, role: Role) => number
): SelectedPlayer[] {
    if (players.length < 10) {
        throw new InsufficientPlayersError(10, players.length);
    }

    const tankPool = players.filter((p) => p.availableRoles.includes('tank'));
    const dpsPool = players.filter((p) => p.availableRoles.includes('dps'));
    const supportPool = players.filter((p) =>
        p.availableRoles.includes('support')
    );

    const requiredRoles = {
        tank: TEAM_COMPOSITION.tank * 2,
        dps: TEAM_COMPOSITION.dps * 2,
        support: TEAM_COMPOSITION.support * 2,
    };

    if (
        tankPool.length < requiredRoles.tank ||
        dpsPool.length < requiredRoles.dps ||
        supportPool.length < requiredRoles.support
    ) {
        throw new InsufficientRoleCompositionError(requiredRoles, {
            tank: tankPool.length,
            dps: dpsPool.length,
            support: supportPool.length,
        });
    }

    const selectedPlayers: SelectedPlayer[] = [];
    const selectedUserIds = new Set<string>();

    /**
     * Select top N players from a pool for a specific role
     */
    function selectFromPool(
        pool: PlayerWithRoles[],
        role: Role,
        count: number
    ): void {
        const availablePlayers = pool.filter(
            (p) => !selectedUserIds.has(p.userId)
        );

        if (availablePlayers.length < count) {
            throw new InsufficientRoleCompositionError(
                requiredRoles,
                {
                    tank: role === 'tank' ? availablePlayers.length : requiredRoles.tank,
                    dps: role === 'dps' ? availablePlayers.length : requiredRoles.dps,
                    support: role === 'support' ? availablePlayers.length : requiredRoles.support,
                }
            );
        }

        const playersWithScores = availablePlayers.map((player) => ({
            player,
            score: getPriorityScore(player.userId, role),
        }));

        const shuffled = playersWithScores.sort(() => Math.random() - 0.5);
        const sorted = shuffled.sort((a, b) => b.score - a.score);

        const selected = sorted.slice(0, count);

        for (const {player, score} of selected) {
            selectedPlayers.push({
                ...player,
                assignedRole: role,
                priorityScore: score,
            });
            selectedUserIds.add(player.userId);
        }
    }

    selectFromPool(tankPool, 'tank', requiredRoles.tank);
    selectFromPool(supportPool, 'support', requiredRoles.support);
    selectFromPool(dpsPool, 'dps', requiredRoles.dps);

    return selectedPlayers;
}
