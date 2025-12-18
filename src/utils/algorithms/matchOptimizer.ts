import {
    PlayerWithRoles,
    Role,
    SelectedPlayer,
    BalancedTeams,
    RoleComposition,
    TEAM_COMPOSITION,
    DEFAULT_OPTIMIZER_CONFIG,
    OptimizerConfig,
} from '../../types/matchmaking';
import { balanceTeamsBySkill } from './rankBalancing';
import {
    InsufficientPlayersError,
    InsufficientRoleCompositionError,
    selectPlayersByPriority,
    selectTopNByPriority,
} from './prioritySelection';

/**
 * Skill band for candidate selection
 */
interface SkillBand {
    min: number;
    max: number;
    spread: number;
    buffer: number;
}

/**
 * Candidate pools by role
 */
interface CandidatePools {
    tanks: PlayerWithRoles[];
    dps: PlayerWithRoles[];
    support: PlayerWithRoles[];
}

/**
 * Result of building candidate pools
 */
interface PoolBuildResult {
    pools: CandidatePools;
    band: SkillBand;
    expandedBand: boolean;
}

/**
 * Selected players by role for a combination
 */
interface RoleSelection {
    tanks: PlayerWithRoles[];    // 2 selected
    dps: PlayerWithRoles[];      // 4 selected
    support: PlayerWithRoles[];  // 4 selected
}

/**
 * Normalization constants for cost calculation
 */
interface NormalizationConstants {
    F_max: number;  // Max possible fairness delta
    P_max: number;  // Max possible priority cost
}

/**
 * Detailed cost metrics for a combination
 */
interface CostMetrics {
    fairnessCost: number;        // |Σteam1.μ - Σteam2.μ|
    priorityCost: number;        // Σ(skipped.priority^1.5)
    normalizedFairness: number;  // fairnessCost / F_max
    normalizedPriority: number;  // priorityCost / P_max
    totalCost: number;           // Weighted sum
}

/**
 * Result of optimization
 */
interface OptimizationResult {
    selectedPlayers: SelectedPlayer[];
    metrics: CostMetrics;
    totalEvaluated: number;
}

/**
 * Generate k-combinations from array
 * Standard combinatorial algorithm
 *
 * @param arr - Array to generate combinations from
 * @param k - Size of each combination
 * @returns Generator yielding k-element arrays
 * @internal Exported for testing
 */
export function* combinations<T>(arr: T[], k: number): Generator<T[]> {
    if (k === 0) {
        yield [];
        return;
    }

    if (k > arr.length) {
        return;
    }

    if (k === arr.length) {
        yield arr.slice();
        return;
    }

    // Recursive approach: either include first element or skip it
    for (let i = 0; i <= arr.length - k; i++) {
        const first = arr[i];
        const rest = arr.slice(i + 1);

        for (const combo of combinations(rest, k - 1)) {
            yield [first, ...combo];
        }
    }
}

/**
 * Calculate adaptive skill band from base team
 *
 * Formula:
 * - spread = max(μ) - min(μ) in base team
 * - buffer = spread × 0.5
 * - range = [min(μ) - buffer, max(μ) + buffer]
 *
 * @param baseTeam - Initial 10 players selected by priority
 * @returns Skill band boundaries
 * @internal Exported for testing
 */
export function calculateSkillBand(baseTeam: SelectedPlayer[]): SkillBand {
    const muValues = baseTeam.map((p) => p.mu);
    const minMu = Math.min(...muValues);
    const maxMu = Math.max(...muValues);
    const spread = maxMu - minMu;

    // Handle zero spread (all same skill level)
    const DEFAULT_BUFFER = 5.0;
    const buffer =
        spread === 0
            ? DEFAULT_BUFFER
            : spread * DEFAULT_OPTIMIZER_CONFIG.skillBandBuffer;

    return {
        min: minMu - buffer,
        max: maxMu + buffer,
        spread,
        buffer,
    };
}

/**
 * Select base 10 players using pure priority selection
 * Used to establish skill band baseline
 *
 * @param players - Available players
 * @param getPriorityScore - Priority calculator
 * @returns Base team and remaining player pools by role
 * @internal Exported for testing
 */
export function selectBaseTeam(
    players: PlayerWithRoles[],
    getPriorityScore: (userId: string, role: Role) => number
): {
    baseTeam: SelectedPlayer[];
    remainingTanks: PlayerWithRoles[];
    remainingDps: PlayerWithRoles[];
    remainingSupport: PlayerWithRoles[];
} {
    // Use existing priority selection to get base 10
    const baseTeam = selectPlayersByPriority(players, getPriorityScore);

    // Create set of selected user IDs
    const selectedUserIds = new Set(baseTeam.map((p) => p.userId));

    // Build remaining pools by role, excluding selected players
    const remainingTanks = players.filter(
        (p) =>
            !selectedUserIds.has(p.userId) &&
            p.availableRoles.includes('tank')
    );

    const remainingDps = players.filter(
        (p) =>
            !selectedUserIds.has(p.userId) && p.availableRoles.includes('dps')
    );

    const remainingSupport = players.filter(
        (p) =>
            !selectedUserIds.has(p.userId) &&
            p.availableRoles.includes('support')
    );

    return {
        baseTeam,
        remainingTanks,
        remainingDps,
        remainingSupport,
    };
}

/**
 * Calculate adaptive pool sizes based on available player count
 *
 * @param playerCount - Total number of available players
 * @returns Target pool sizes for each role
 * @internal
 */
function calculateAdaptivePoolSizes(playerCount: number): RoleComposition {
    // Scale pool sizes based on available players
    if (playerCount <= 12) {
        // Small pool: minimal extra candidates (11-12 players → 3/5/5 pools)
        return { tank: 3, dps: 5, support: 5 };
    } else if (playerCount <= 15) {
        // Medium pool: moderate extras (13-15 players → 3/5/5)
        return { tank: 3, dps: 5, support: 5 };
    } else {
        // Large pool: full target sizes (16+ players → 4/6/6)
        return { tank: 4, dps: 6, support: 6 };
    }
}

/**
 * Build candidate pools within skill band (ADAPTIVE)
 *
 * Selection criteria:
 * - Filters ALL players to those within skill band
 * - Builds pools by role from in-band players
 * - Uses adaptive pool sizes based on total player count
 * - No artificial separation of base team vs reserves
 *
 * Fallback: If pools aren't filled to target size, expand band and retry.
 *
 * @param allPlayers - All available players
 * @param baseTeam - Base team (used for skill band reference only)
 * @param band - Initial skill band
 * @param getPriorityScore - Priority calculator
 * @returns Candidate pools and final band used
 * @internal Exported for testing
 */
export function buildCandidatePools(
    allPlayers: PlayerWithRoles[],
    baseTeam: SelectedPlayer[],
    band: SkillBand,
    getPriorityScore: (userId: string, role: Role) => number
): PoolBuildResult {
    const config = DEFAULT_OPTIMIZER_CONFIG;

    // Calculate adaptive target pool sizes based on total player count
    const targetPoolSizes = calculateAdaptivePoolSizes(allPlayers.length);

    /**
     * Attempt to build pools with given skill band
     */
    function attemptBuild(currentBand: SkillBand): { pools: CandidatePools; isFull: boolean } {
        // Filter ALL players to those within skill band (no base/reserve distinction)
        const inBandPlayers = allPlayers.filter(
            (p) => p.mu >= currentBand.min && p.mu <= currentBand.max
        );

        // Separate by role (players can appear in multiple role lists if flex)
        const tankCandidates = inBandPlayers.filter(p =>
            p.availableRoles.includes('tank')
        );
        const dpsCandidates = inBandPlayers.filter(p =>
            p.availableRoles.includes('dps')
        );
        const supportCandidates = inBandPlayers.filter(p =>
            p.availableRoles.includes('support')
        );

        // Select top N by priority for each role (up to target or available)
        const tanks = selectTopNByPriority(
            tankCandidates,
            'tank',
            Math.min(targetPoolSizes.tank, tankCandidates.length),
            getPriorityScore
        );

        const dps = selectTopNByPriority(
            dpsCandidates,
            'dps',
            Math.min(targetPoolSizes.dps, dpsCandidates.length),
            getPriorityScore
        );

        const support = selectTopNByPriority(
            supportCandidates,
            'support',
            Math.min(targetPoolSizes.support, supportCandidates.length),
            getPriorityScore
        );

        const isFull =
            tanks.length >= targetPoolSizes.tank &&
            dps.length >= targetPoolSizes.dps &&
            support.length >= targetPoolSizes.support;

        return {
            pools: { tanks, dps, support },
            isFull
        };
    }

    // First attempt with initial band
    let result = attemptBuild(band);

    if (result.isFull) {
        return {
            pools: result.pools,
            band,
            expandedBand: false,
        };
    }

    // Expansion fallback: expand buffer by 25%
    const expandedBand: SkillBand = {
        ...band,
        buffer: band.buffer * config.bandExpansionFactor,
        min: band.min - (band.buffer * (config.bandExpansionFactor - 1)),
        max: band.max + (band.buffer * (config.bandExpansionFactor - 1)),
    };

    result = attemptBuild(expandedBand);

    // Return whatever we found (even if not full), as base team ensures validity
    return {
        pools: result.pools,
        band: expandedBand,
        expandedBand: true,
    };
}

/**
 * Generate all valid role-stratified combinations
 *
 * Generates: C(4,2) × C(6,4) × C(6,4) = 6 × 15 × 15 = 1,350 combinations
 *
 * @param pools - Candidate pools (4 tanks, 6 DPS, 6 support)
 * @returns Generator yielding combinations
 */
export function* generateCombinations(pools: CandidatePools): Generator<RoleSelection> {
    // Generate all valid 10-player combinations
    // C(4,2) tanks × C(6,4) DPS × C(6,4) support = 1,350 combinations
    for (const tankCombo of combinations(pools.tanks, 2)) {
        for (const dpsCombo of combinations(pools.dps, 4)) {
            for (const supportCombo of combinations(pools.support, 4)) {
                yield {
                    tanks: tankCombo,
                    dps: dpsCombo,
                    support: supportCombo
                };
            }
        }
    }
}

/**
 * Calculate normalization constants from candidate pools
 *
 * Handles Infinity priorities by capping at a reasonable maximum
 * (e.g., 10 years = 3650 days for players who have never played)
 *
 * @param pools - Candidate pools
 * @param getPriorityScore - Priority calculator
 * @returns Normalization constants for cost calculation
 */
export function calculateNormalizationConstants(
    pools: CandidatePools,
    getPriorityScore: (userId: string, role: Role) => number
): NormalizationConstants {
    const allCandidates = [...pools.tanks, ...pools.dps, ...pools.support];

    // F_max: Maximum possible skill difference
    // Formula: (max_μ - min_μ) × 5 players per team
    const allMuValues = allCandidates.map(p => p.mu);
    const maxMu = Math.max(...allMuValues);
    const minMu = Math.min(...allMuValues);
    const F_max = (maxMu - minMu) * 5;

    // P_max: Maximum possible priority penalty
    // Handle Infinity: cap priority at reasonable maximum (10 years = 3650 days)
    const MAX_PRIORITY_FOR_CALC = 365 * 10;

    // Deduplicate candidates by userId (since flex players appear in multiple pools)
    const uniqueCandidates = new Map<string, PlayerWithRoles>();
    for (const player of allCandidates) {
        uniqueCandidates.set(player.userId, player);
    }

    let P_max = 0;
    for (const player of uniqueCandidates.values()) {
        const priority = getPriorityScore(player.userId, player.availableRoles[0]);
        const cappedPriority = Math.min(priority, MAX_PRIORITY_FOR_CALC);
        P_max += Math.pow(cappedPriority, 1.5);
    }

    return {
        F_max: F_max || 1, // Prevent division by zero
        P_max: P_max || 1  // Prevent division by zero
    };
}

/**
 * Calculate cost metrics for a team combination
 *
 * Cost Formula:
 * - F = |Σteam1.μ - Σteam2.μ|
 * - P = Σ(skipped.priority^1.5) for all skipped players
 * - F_norm = F / F_max
 * - P_norm = P / P_max
 * - Cost = 0.2 × F_norm² + 0.8 × P_norm^1.5
 *
 * Handles Infinity priorities by capping at a reasonable maximum
 *
 * @param teams - Balanced teams from balanceTeamsBySkill()
 * @param selection - Selected 10 players
 * @param allCandidates - All candidate players with priority scores
 * @param normalization - Normalization constants
 * @returns Detailed cost metrics
 */
export function calculateCost(
    teams: BalancedTeams,
    selection: RoleSelection,
    allCandidates: Map<string, { player: PlayerWithRoles; priority: number }>,
    normalization: NormalizationConstants,
    config: OptimizerConfig = DEFAULT_OPTIMIZER_CONFIG
): CostMetrics {
    const MAX_PRIORITY_FOR_CALC = 365 * 10; // 10 years in days

    // Step 1: Calculate Fairness Cost
    // F = |Σteam1.μ - Σteam2.μ|
    const team1MuSum = teams.team1.reduce((sum, p) => sum + p.mu, 0);
    const team2MuSum = teams.team2.reduce((sum, p) => sum + p.mu, 0);
    const fairnessCost = Math.abs(team1MuSum - team2MuSum);

    // Step 2: Calculate Priority Penalty with Infinity handling
    // P = Σ(skipped_players.priority^1.5)
    const selectedUserIds = new Set([
        ...selection.tanks.map(p => p.userId),
        ...selection.dps.map(p => p.userId),
        ...selection.support.map(p => p.userId)
    ]);

    let priorityCost = 0;
    for (const [userId, { priority }] of allCandidates) {
        if (!selectedUserIds.has(userId)) {
            const cappedPriority = Math.min(priority, MAX_PRIORITY_FOR_CALC);
            priorityCost += Math.pow(cappedPriority, 1.5);
        }
    }

    // Step 3: Normalize both costs to [0, 1]
    const normalizedFairness = fairnessCost / normalization.F_max;
    const normalizedPriority = priorityCost / normalization.P_max;

    // Step 4: Apply weights and exponents
    // Total Cost = W_fairness × F_norm² + W_priority × P_norm^1.5
    const weightedFairness = config.fairnessWeight * Math.pow(normalizedFairness, 2);
    const weightedPriority = config.priorityWeight * Math.pow(normalizedPriority, 1.5);
    const totalCost = weightedFairness + weightedPriority;

    return {
        fairnessCost,
        priorityCost,
        normalizedFairness,
        normalizedPriority,
        totalCost
    };
}

/**
 * Evaluate all combinations and select optimal one
 *
 * Process:
 * 1. For each combination:
 *    a. Assign roles and priority scores
 *    b. Balance teams with balanceTeamsBySkill()
 *    c. Calculate cost metrics
 * 2. Track combination with minimum cost
 * 3. Return optimal selection
 *
 * @param pools - Candidate pools
 * @param allCandidates - Map of userId → player + priority
 * @param normalization - Normalization constants
 * @param getPriorityScore - Priority calculator
 * @returns Optimal team selection with metrics
 */
export function selectOptimalCombination(
    pools: CandidatePools,
    allCandidates: Map<string, { player: PlayerWithRoles; priority: number }>,
    normalization: NormalizationConstants,
    config: OptimizerConfig = DEFAULT_OPTIMIZER_CONFIG
): OptimizationResult {
    let bestCost = Infinity;
    let bestSelection: RoleSelection | null = null;
    let bestTeams: BalancedTeams | null = null;
    let bestMetrics: CostMetrics | null = null;
    let totalEvaluated = 0;
    let validSetsFound = 0;

    // Iterate through all combinations
    for (const selection of generateCombinations(pools)) {
        totalEvaluated++;

        // Validate uniqueness: ensure no player is selected for multiple roles
        const uniqueUserIds = new Set([
            ...selection.tanks.map(p => p.userId),
            ...selection.dps.map(p => p.userId),
            ...selection.support.map(p => p.userId)
        ]);

        if (uniqueUserIds.size !== 10) {
            continue; // Skip combinations with duplicate players
        }

        validSetsFound++;

        // Convert RoleSelection to SelectedPlayer[]
        const selectedPlayers: SelectedPlayer[] = [
            ...selection.tanks.map(p => ({
                ...p,
                assignedRole: 'tank' as Role,
                priorityScore: allCandidates.get(p.userId)!.priority
            })),
            ...selection.dps.map(p => ({
                ...p,
                assignedRole: 'dps' as Role,
                priorityScore: allCandidates.get(p.userId)!.priority
            })),
            ...selection.support.map(p => ({
                ...p,
                assignedRole: 'support' as Role,
                priorityScore: allCandidates.get(p.userId)!.priority
            }))
        ];

        // Balance teams
        const balancedTeams = balanceTeamsBySkill(selectedPlayers);

        // Calculate cost
        const metrics = calculateCost(balancedTeams, selection, allCandidates, normalization, config);

        // Track minimum
        if (metrics.totalCost < bestCost) {
            bestCost = metrics.totalCost;
            bestSelection = selection;
            bestTeams = balancedTeams;
            bestMetrics = metrics;
        }
    }

    if (!bestTeams || !bestMetrics || !bestSelection) {
        // Count unique candidates per role for accurate error reporting
        const uniqueTanks = new Set(pools.tanks.map(p => p.userId)).size;
        const uniqueDps = new Set(pools.dps.map(p => p.userId)).size;
        const uniqueSupport = new Set(pools.support.map(p => p.userId)).size;

        throw new InsufficientRoleCompositionError(
            { tank: 2, dps: 4, support: 4 },
            { tank: uniqueTanks, dps: uniqueDps, support: uniqueSupport }
        );
    }

    // Convert best selection to SelectedPlayer[]
    const selectedPlayers: SelectedPlayer[] = [
        ...bestSelection.tanks.map(p => ({
            ...p,
            assignedRole: 'tank' as Role,
            priorityScore: allCandidates.get(p.userId)!.priority
        })),
        ...bestSelection.dps.map(p => ({
            ...p,
            assignedRole: 'dps' as Role,
            priorityScore: allCandidates.get(p.userId)!.priority
        })),
        ...bestSelection.support.map(p => ({
            ...p,
            assignedRole: 'support' as Role,
            priorityScore: allCandidates.get(p.userId)!.priority
        }))
    ];

    return {
        selectedPlayers,
        metrics: bestMetrics,
        totalEvaluated
    };
}

/**
 * Priority-weighted quality search algorithm
 *
 * Finds optimal team composition by:
 * 1. Selecting base 10 players by priority
 * 2. Building candidate pools within adaptive skill band
 * 3. Evaluating combinations with weighted cost function
 * 4. Returning combination with minimum cost
 *
 * @param players - Available players with roles and mu
 * @param getPriorityScore - Function to calculate priority score
 * @returns 10 selected players with optimal balance
 * @throws {InsufficientPlayersError} If fewer than 10 players
 * @throws {InsufficientRoleCompositionError} If role composition can't be met
 */
export function optimizeMatchSelection(
    players: PlayerWithRoles[],
    getPriorityScore: (userId: string, role: Role) => number,
    config: OptimizerConfig = DEFAULT_OPTIMIZER_CONFIG
): SelectedPlayer[] {
    // Step 1: Validate input
    if (players.length < 10) {
        throw new InsufficientPlayersError(10, players.length);
    }

    // Step 2: Select base 10 players (highest priority with valid composition)
    const { baseTeam } = selectBaseTeam(players, getPriorityScore);

    // Step 3: If exactly 10 players, return base team (no optimization needed)
    if (players.length === 10) {
        return baseTeam;
    }

    // Step 4: Calculate adaptive skill band
    const skillBand = calculateSkillBand(baseTeam);

    // Step 5: Build candidate pools within skill band
    let poolBuildResult;
    try {
        poolBuildResult = buildCandidatePools(
            players,
            baseTeam,
            skillBand,
            getPriorityScore
        );
    } catch (error) {
        // If we can't build candidate pools, return base team
        // This can happen when remaining players don't have proper role distribution
        return baseTeam;
    }

    const { pools } = poolBuildResult;

    // Step 6: Check if optimization is possible
    // Need at least 2 tanks, 4 DPS, 4 support to form a complete team for comparison
    if (pools.tanks.length < 2 || pools.dps.length < 4 || pools.support.length < 4) {
        // Not enough candidates to optimize - return base team
        return baseTeam;
    }

    // If pools exactly match required sizes, no alternatives to consider
    if (pools.tanks.length === 2 && pools.dps.length === 4 && pools.support.length === 4) {
        return baseTeam;
    }

    // Step 7: Build candidate map for cost calculation
    // Note: Automatically deduplicates since Map keys are unique (userId)
    const allCandidates = new Map<string, { player: PlayerWithRoles; priority: number }>();
    for (const player of [...pools.tanks, ...pools.dps, ...pools.support]) {
        if (!allCandidates.has(player.userId)) {
            const priority = getPriorityScore(player.userId, player.availableRoles[0]);
            allCandidates.set(player.userId, { player, priority });
        }
    }

    // Step 7b: Check if we have enough unique candidates
    // With flex players, pools may overlap significantly
    // Need at least 10 unique players to form valid combinations
    if (allCandidates.size < 10) {
        // Not enough unique candidates - return base team
        return baseTeam;
    }

    // Step 8: Calculate normalization constants
    const normalization = calculateNormalizationConstants(pools, getPriorityScore);

    // Step 9: Select optimal combination
    try {
        const result = selectOptimalCombination(pools, allCandidates, normalization, config);
        return result.selectedPlayers;
    } catch (error) {
        // If optimization fails (e.g., no valid combinations found), return base team
        if (error instanceof InsufficientRoleCompositionError) {
            return baseTeam;
        }
        throw error;
    }
}
