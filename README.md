# Overwatch 2 PUG Bot

A Discord bot for organizing Overwatch 2 Pick-Up Games with intelligent matchmaking, rank-based team balancing, and
automated match management.

## Capabilities

- Player registration with multi-role support (tank, dps, support)
- Smart player selection prioritizing those who haven't played recently
- Rank-based team balancing for fair 5v5 matches
- Automatic voice channel assignment for teams
- Match tracking with win/loss statistics
- Scheduled PUG events with 24-hour and 1-hour reminders
- Flexible permission system with configurable PUG Leader roles

## Usage Flow

1. **Server Configuration**: Admin configures voice channels and roles using `/setup` commands
2. **Player Registration**: Players register with `/register <battletag> <roles> <rank>`
3. **Match Creation**: Admin runs `/makepug create` to select 10 players and create balanced teams
4. **Match Start**: Admin runs `/makepug start` to move players to team voice channels
5. **Match Completion**: Admin runs `/match finish <team>` to record results and update statistics

## Tech Stack

- Discord.js v14, TypeScript, better-sqlite3, node-cron

## Setup

### Bot Invite

When creating your bot invite URL, use these settings:

**OAuth2 Scopes:**

- `bot`
- `applications.commands`

**Bot Permissions:**

- View Channels
- Manage Events
- Create Events
- Mention Everyone
- Move Members
- Connect

### Installation

1. Clone and install dependencies:

```bash
npm install
```

2. Create `.env` file:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_application_id
```

3. Build and deploy commands:

```bash
npm run build
node dist/deploy-commands.js
```

4. Start the bot:

```bash
node dist/index.js
```

### Server Configuration

Run these commands in your Discord server:

```
/setup mainvc <channel>              # Main lobby voice channel
/setup team1vc <channel>             # Team 1 voice channel
/setup team2vc <channel>             # Team 2 voice channel
/setup announcementchannel <channel> # Announcements channel
/setup pugrole <role>                # Role to mention for PUGs
/setup pugleader add <role>          # Add PUG management role
/setup automove true                 # Enable automatic voice moves
```

## Key Commands

**Players:**

- `/register <battletag> <roles> <rank>` - Register for PUGs
- `/update [battlenet] [roles] [rank]` - Update your info
- `/profile [user]` - View player stats
- `/roster` - Check voice channel readiness

**Match Management (Admin/PUG Leader):**

- `/makepug create` - Create match from players in voice
- `/makepug start` - Start match and move players
- `/match finish <winner>` - Record match result
- `/match view` - View current match details

**Scheduling (Admin):**

- `/schedulepug <date> <hour> <minute>` - Schedule future PUG
- `/listpugs` - View upcoming PUGs
- `/cancelpug <id>` - Cancel scheduled PUG

## Testing

The project uses Jest with TypeScript for comprehensive testing of algorithms and database operations.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:algorithms     # Algorithm tests only
npm run test:database       # Database tests only

# Run tests in CI mode (used by GitHub Actions)
npm run test:ci
```

### Test Coverage

The project maintains high test coverage standards:

- **Algorithms**: 100% coverage (priority selection, rank balancing)
- **Database**: 90%+ coverage (players, matches, guild config)
- **Overall**: 80%+ coverage across all tested modules

View the coverage report after running `npm run test:coverage` - it generates an HTML report in
`coverage/lcov-report/index.html`.

### Test Structure

```
tests/
├── setup/               # Test utilities and helpers
│   └── testUtils.ts     # Database helpers for in-memory SQLite
├── fixtures/            # Mock data factories
│   ├── players.ts       # Player mock generation
│   └── scenarios.ts     # Common test scenarios
├── unit/
│   ├── algorithms/      # Algorithm tests (100% coverage)
│   │   ├── prioritySelection.test.ts
│   │   └── rankBalancing.test.ts
│   └── database/        # Database operation tests
│       ├── players.test.ts
│       ├── matches.test.ts
│       └── config.test.ts
└── integration/
    └── matchmaking.test.ts  # End-to-end matchmaking flow
```

### Testing Philosophy

- **Isolation**: Each test uses a fresh in-memory SQLite database (`:memory:`) for speed and independence
- **Determinism**: Mock data uses predictable IDs and values to ensure reproducible results
- **Coverage**: Critical business logic (algorithms) has 100% branch coverage
- **Real-world scenarios**: Tests cover edge cases, error handling, and complete workflows

### Continuous Integration

Tests run automatically on every push and pull request via GitHub Actions:

- Tested on Node.js 18.x and 20.x
- Includes TypeScript compilation check

See `.github/workflows/test.yml` for CI configuration.

### Contributing Guidelines

When adding new features:

1. Write tests first (TDD encouraged for algorithms and database logic)
2. Ensure existing tests pass: `npm test`
3. Add tests for new functionality
4. Verify coverage meets thresholds: `npm run test:coverage`
5. Use existing fixtures and test utilities for consistency
