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
