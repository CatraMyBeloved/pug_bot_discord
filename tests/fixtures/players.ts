import {PlayerWithRoles, Rank, Role, SelectedPlayer} from '../../src/types/matchmaking';


let userIdCounter = 1;


export function resetUserIdCounter(): void {
    userIdCounter = 1;
}


export function createMockPlayer(
    overrides?: Partial<PlayerWithRoles>
): PlayerWithRoles {
    const id = userIdCounter++;
    return {
        userId: `user${id}`,
        battlenetId: `Player${id}#1234`,
        availableRoles: ['dps'],
        rank: 'gold',
        ...overrides,
    };
}


export function createMockSelectedPlayer(
    overrides?: Partial<SelectedPlayer>
): SelectedPlayer {
    const player = createMockPlayer(overrides);
    return {
        ...player,
        assignedRole: (overrides?.assignedRole || player.availableRoles[0]) as Role,
        priorityScore: 0,
        ...overrides,
    };
}


export function createMockRoster(
    tanks: number,
    dps: number,
    supports: number,
    rank: Rank = 'gold'
): PlayerWithRoles[] {
    const players: PlayerWithRoles[] = [];

    for (let i = 0; i < tanks; i++) {
        players.push(createMockPlayer({availableRoles: ['tank'], rank}));
    }
    for (let i = 0; i < dps; i++) {
        players.push(createMockPlayer({availableRoles: ['dps'], rank}));
    }
    for (let i = 0; i < supports; i++) {
        players.push(createMockPlayer({availableRoles: ['support'], rank}));
    }

    return players;
}


export function createStandardRoster(rank: Rank = 'gold'): PlayerWithRoles[] {
    return createMockRoster(2, 4, 4, rank);
}


export function createSelectedPlayersForBalancing(
    ranks: Rank[] = ['grandmaster', 'master', 'diamond', 'platinum', 'gold', 'silver', 'bronze', 'bronze', 'bronze', 'bronze']
): SelectedPlayer[] {
    const roles: Role[] = ['tank', 'tank', 'dps', 'dps', 'dps', 'dps', 'support', 'support', 'support', 'support'];

    return ranks.map((rank, index) =>
        createMockSelectedPlayer({
            rank,
            assignedRole: roles[index],
            priorityScore: 100 - index,
        })
    );
}
