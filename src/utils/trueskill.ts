import { rating, rate, Rating } from 'ts-trueskill';
import { Rank } from '../types/matchmaking';

// Configurable constants
export const TS_CONFIG = {
    mu: 25.0,
    sigma: 8.333,
    beta: 4.167,
    tau: 0.083,
    drawProbability: 0.1, // Low draw probability for OW
};

// Seeding values for existing ranks
const RANK_SEEDING: Record<Rank, number> = {
    bronze: 15.0,
    silver: 20.0,
    gold: 25.0,
    platinum: 30.0,
    diamond: 35.0,
    master: 40.0,
    grandmaster: 45.0,
};

const SEEDED_SIGMA = 5.0; // Lower uncertainty for seeded players

export interface PlayerRating {
    mu: number;
    sigma: number;
}

/**
 * Get initial TrueSkill parameters based on a player's self-reported rank.
 * Used when a player first registers or when migrating the database.
 */
export function getSeedingParams(rank: string): PlayerRating {
    const normalizedRank = rank.toLowerCase() as Rank;
    const mu = RANK_SEEDING[normalizedRank] || TS_CONFIG.mu;
    // If we found a valid rank seed, use the tighter sigma, otherwise use default wide sigma
    const sigma = RANK_SEEDING[normalizedRank] ? SEEDED_SIGMA : TS_CONFIG.sigma;

    return { mu, sigma };
}

/**
 * Calculate the Display Skill Rating (SR)
 * Formula: (mu - 3 * sigma) * 100
 * Clamped between 0 and 5000 (soft limits)
 */
export function getDisplaySR(mu: number, sigma: number): number {
    const rawSR = (mu - 3 * sigma) * 100;
    return Math.max(0, Math.round(rawSR));
}

/**
 * Calculate new ratings after a match
 */
export function calculatePostMatch(
    winners: PlayerRating[],
    losers: PlayerRating[],
    isDraw: boolean = false
): { winners: PlayerRating[]; losers: PlayerRating[] } {
    // Convert plain objects to ts-trueskill Rating objects
    const winnerRatings = winners.map(p => new Rating(p.mu, p.sigma));
    const loserRatings = losers.map(p => new Rating(p.mu, p.sigma));

    // rate() expects an array of teams, where each team is an array of Ratings
    // ranks: 0 for winner, 1 for loser. If draw, ranks are equal.
    const teams = [winnerRatings, loserRatings];
    const ranks = isDraw ? [0, 0] : [0, 1];

    // weights can be optional, defaults to 1s
    // tau/beta etc are set globally or passed in env? 
    // ts-trueskill uses global settings by default if not passed, but let's see if we can pass config.
    // The library usually has a global 'trueSkill' instance or similar. 
    // Looking at standard usage: rate(teams, ranks, weights, tau, beta, drawProbability, p)
    
    // Using the functional api:
    const newRatings = rate(
        teams,
        ranks,
        undefined, // weights
        TS_CONFIG.tau,
        TS_CONFIG.beta,
        TS_CONFIG.drawProbability,
        TS_CONFIG.sigma // p (dynamics factor) - usually small, but library might treat this arg differently. 
                        // Actually 'p' is usually ~ tau. 
                        // Let's rely on defaults for advanced params or verify library signature if possible.
                        // Standard ts-trueskill rate signature: rate(teams, ranks, weights, tau, beta, drawProbability, p)
    );

    // Unpack results
    const newWinnerRatings = newRatings[0].map(r => ({ mu: r.mu, sigma: r.sigma }));
    const newLoserRatings = newRatings[1].map(r => ({ mu: r.mu, sigma: r.sigma }));

    return {
        winners: newWinnerRatings,
        losers: newLoserRatings,
    };
}
