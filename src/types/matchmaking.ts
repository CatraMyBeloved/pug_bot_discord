/**
 * Role types for Overwatch
 */
export type Role = 'tank' | 'dps' | 'support';

/**
 * Rank types for Overwatch
 */
export type Rank =
    | 'bronze'
    | 'silver'
    | 'gold'
    | 'platinum'
    | 'diamond'
    | 'master'
    | 'grandmaster';

/**
 * Player with their available roles (before selection)
 */
export interface PlayerWithRoles {
    userId: string;
    battlenetId: string;
    availableRoles: Role[];
    rank: Rank;
    mu: number;
}

/**
 * Selected player with assigned role and priority score
 */
export interface SelectedPlayer extends PlayerWithRoles {
    assignedRole: Role;
    priorityScore: number;
}

/**
 * Balanced teams result
 */
export interface BalancedTeams {
    team1: SelectedPlayer[];
    team2: SelectedPlayer[];
}

/**
 * Role composition requirements for a team
 */
export interface RoleComposition {
    tank: number;
    dps: number;
    support: number;
}

/**
 * Standard 5v5 composition: 1 tank, 2 DPS, 2 support per team
 */
export const TEAM_COMPOSITION: RoleComposition = {
    tank: 1,
    dps: 2,
    support: 2,
};

/**
 * Player selection algorithm function signature
 * Takes players and a priority calculator, returns 10 selected players
 */
export type PlayerSelectionAlgorithm = (
    players: PlayerWithRoles[],
    getPriorityScore: (userId: string, role: Role) => number
) => SelectedPlayer[];

/**
 * Team balancing algorithm function signature
 * Takes 10 selected players, returns balanced teams
 */
export type TeamBalancingAlgorithm = (
    players: SelectedPlayer[]
) => BalancedTeams;

/**
 * Rank value mapping for team balancing calculations
 */
export const RANK_VALUES: Record<Rank, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
    diamond: 5,
    master: 6,
    grandmaster: 7,
};

/**
 * Configuration for match optimizer (V2 matchmaking)
 */
export interface OptimizerConfig {
    /** Pool size multiplier per role (e.g., 2 → 4 tanks, 6 DPS, 6 support) */
    poolSizeMultiplier: number;

    /** Skill band buffer multiplier (applied to spread) */
    skillBandBuffer: number;

    /** Weight for fairness cost (0-1) */
    fairnessWeight: number;

    /** Weight for priority cost (0-1) */
    priorityWeight: number;

    /** Band expansion multiplier if insufficient candidates */
    bandExpansionFactor: number;
}

/**
 * Default optimizer configuration
 * - +2 per role (4 tanks, 6 DPS, 6 support)
 * - Adaptive buffer = 0.5 × skill spread
 * - Strongly favor priority: 80% priority, 20% fairness
 * - Expand band by 25% if insufficient candidates
 */
export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
    poolSizeMultiplier: 2,
    skillBandBuffer: 0.5,
    fairnessWeight: 0.2,
    priorityWeight: 0.8,
    bandExpansionFactor: 1.25,
};
