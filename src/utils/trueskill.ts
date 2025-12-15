import {Rating, TrueSkill} from 'ts-trueskill';
import {Rank} from '../types/matchmaking';

// Configurable constants for the TrueSkill algorithm
export const TRUESKILL_CONFIG = {
    initialMean: 25.0,        // Starting skill rating (mu)
    initialStandardDeviation: 8.333, // Starting uncertainty (sigma)
    beta: 4.167,              // Skill difference guaranteeing ~76% win chance
    tau: 0.083,               // Dynamic factor (additive uncertainty over time)
    drawProbability: 0.1,     // Low draw probability for Overwatch
};

// Initialize the TrueSkill rating system instance
const trueSkillSystem = new TrueSkill(
    TRUESKILL_CONFIG.initialMean,
    TRUESKILL_CONFIG.initialStandardDeviation,
    TRUESKILL_CONFIG.beta,
    TRUESKILL_CONFIG.tau,
    TRUESKILL_CONFIG.drawProbability
);

const RANK_SEEDING: Record<Rank, number> = {
    bronze: 15.0,
    silver: 20.0,
    gold: 25.0,
    platinum: 30.0,
    diamond: 35.0,
    master: 40.0,
    grandmaster: 45.0,
};

const SEEDED_SIGMA = 5.0; // Lower uncertainty for seeded players (we are more confident in their rank)

export interface PlayerRating {
    /** The average skill rating of the player (Mu). Higher is better. */
    mu: number;
    /** The standard deviation/uncertainty of the rating (Sigma). Lower means more confident. */
    sigma: number;
}

/**
 * Get initial TrueSkill parameters based on a player's self-reported rank.
 * Used when a player first registers or when migrating the database.
 */
export function getSeedingParams(rank: string): PlayerRating {
    const normalizedRank = rank.toLowerCase() as Rank;
    const mu = RANK_SEEDING[normalizedRank] || TRUESKILL_CONFIG.initialMean;
    // If we found a valid rank seed, use the tighter sigma, otherwise use default wide sigma
    const sigma = RANK_SEEDING[normalizedRank] ? SEEDED_SIGMA : TRUESKILL_CONFIG.initialStandardDeviation;

    return {mu, sigma};
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
    const winnerRatings = winners.map(player => new Rating(player.mu, player.sigma));
    const loserRatings = losers.map(player => new Rating(player.mu, player.sigma));


    const teams = [winnerRatings, loserRatings];
    // Ranks: 0 = 1st place (winner), 1 = 2nd place (loser). If draw, both are 0.
    const teamRanks = isDraw ? [0, 0] : [0, 1];


    const newRatings = trueSkillSystem.rate(teams, teamRanks);

    // Unpack results from the library's format back to our simple interface
    const newWinnerRatings = (newRatings[0] as Rating[]).map(rating => ({
        mu: rating.mu,
        sigma: rating.sigma
    }));
    const newLoserRatings = (newRatings[1] as Rating[]).map(rating => ({
        mu: rating.mu,
        sigma: rating.sigma
    }));

    return {
        winners: newWinnerRatings,
        losers: newLoserRatings,
    };
}
