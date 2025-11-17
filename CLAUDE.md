# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot for organizing PUG (Pick Up Game) matches for Overwatch. Players register with their BattleNet ID, role, and rank, and the bot manages match creation and team assignments.

**Stack**: TypeScript, Discord.js v14, better-sqlite3 (SQLite)

## Development Commands

```bash
# Build the project
npm run build

# Deploy slash commands to Discord (required after adding/modifying commands)
node dist/deploy-commands.js

# Run the bot (after building)
node dist/index.js
```

## Environment Setup

Create a `.env` file with:
```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_test_guild_id
```

## Architecture

### Entry Point
- `src/index.ts`: Initializes Discord client, database, and registers command handlers

### Database Layer (`src/database/`)
- **init.ts**: Creates/initializes SQLite database with schema
  - Tables: `players`, `matches`, `match_participants`, `guild_config`
  - Database stored at `data/bot.db`
- **players.ts**: Player registration and lookup functions
- **config.ts**: Guild-specific configuration (voice channels, auto-move settings)

### Commands (`src/commands/`)
Each command module exports:
- `data`: SlashCommandBuilder definition
- `execute(interaction, db)`: Command execution logic

**Adding a new command**:
1. Create new file in `src/commands/`
2. Export `data` and `execute`
3. Import and register in `src/index.ts` interaction handler
4. Add to commands array in `src/deploy-commands.ts`
5. Build and run deploy-commands.js

### Database Schema Notes
- Players are identified by Discord user ID (primary key)
- Matches track state ('active', etc.), teams, and voice channels
- Guild config supports per-server voice channel assignments
- Foreign keys enabled: match_participants references both matches and players

## Key Patterns

- All command responses use ephemeral flags for privacy
- Database operations use prepared statements for safety
- Guild config uses UPSERT pattern (INSERT...ON CONFLICT DO UPDATE)
- Database instance passed to command handlers from main initialization
