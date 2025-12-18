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
 * Select top N players from a pool by priority for a specific role
 * Exported for reuse in match optimizer
 *
 * @param pool - Available players for this role
 * @param role - Role to assign
 * @param count - Number of players to select
 * @param getPriorityScore - Priority calculator
 * @param excludeUserIds - Set of user IDs to exclude from selection
 * @returns Selected players with assigned role and priority score
 */
export function selectTopNByPriority(
    pool: PlayerWithRoles[],
    role: Role,
    count: number,
    getPriorityScore: (userId: string, role: Role) => number,
    excludeUserIds: Set<string> = new Set()
): SelectedPlayer[] {
    const availablePlayers = pool.filter(
        (p) => !excludeUserIds.has(p.userId)
    );

    if (availablePlayers.length < count) {
        return availablePlayers.map((player) => ({
            ...player,
            assignedRole: role,
            priorityScore: getPriorityScore(player.userId, role),
        }));
    }

    const playersWithScores = availablePlayers.map((player) => ({
        player,
        score: getPriorityScore(player.userId, role),
    }));

    // Shuffle first to break ties randomly, then sort by score
    const shuffled = playersWithScores.sort(() => Math.random() - 0.5);
    const sorted = shuffled.sort((a, b) => b.score - a.score);

    const selected = sorted.slice(0, count);

    return selected.map(({ player, score }) => ({
        ...player,
        assignedRole: role,
        priorityScore: score,
    }));
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

    // Select tanks first (scarce role)
    const tanks = selectTopNByPriority(
        tankPool,
        'tank',
        requiredRoles.tank,
        getPriorityScore,
        selectedUserIds
    );

    if (tanks.length < requiredRoles.tank) {
        throw new InsufficientRoleCompositionError(requiredRoles, {
            tank: tanks.length,
            dps: dpsPool.length,
            support: supportPool.length,
        });
    }

    selectedPlayers.push(...tanks);
    tanks.forEach((p) => selectedUserIds.add(p.userId));

    // Select supports second
    const supports = selectTopNByPriority(
        supportPool,
        'support',
        requiredRoles.support,
        getPriorityScore,
        selectedUserIds
    );

    if (supports.length < requiredRoles.support) {
        throw new InsufficientRoleCompositionError(requiredRoles, {
            tank: requiredRoles.tank,
            dps: dpsPool.length,
            support: supports.length,
        });
    }

    selectedPlayers.push(...supports);
    supports.forEach((p) => selectedUserIds.add(p.userId));

    // Select DPS last
    const dps = selectTopNByPriority(
        dpsPool,
        'dps',
        requiredRoles.dps,
        getPriorityScore,
        selectedUserIds
    );

    if (dps.length < requiredRoles.dps) {
        throw new InsufficientRoleCompositionError(requiredRoles, {
            tank: requiredRoles.tank,
            dps: dps.length,
            support: requiredRoles.support,
        });
    }

    selectedPlayers.push(...dps);

    return selectedPlayers;
}
