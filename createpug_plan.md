# Discord PUG Bot - Complete System Plan

## Overview

A Discord bot for managing Pick-Up Games (PUGs) with automatic matchmaking, team balancing, and voice channel
management. The bot selects players from a voice channel based on priority (time since last match and rank), creates
balanced teams, and manages match flow.

## Match Configuration

- **Format:** 5v5 (10 players total)
- **Role Composition per Team:** 1 Tank, 2 DPS, 2 Support
- **Minimum Players Required:** 10+ registered players in main voice channel

## Database Schema

### players

```sql
CREATE TABLE players (
  discord_user_id TEXT PRIMARY KEY,
  battlenet_id TEXT NOT NULL,
  role TEXT NOT NULL,                   -- 'tank', 'dps', 'support'
  rank TEXT NOT NULL,                   -- 'bronze', 'silver', 'gold', 'platin', 'diamond', 'master', 'grandmaster'
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_role ON players(role);
```

### matches

```sql
CREATE TABLE matches (
  match_id INTEGER PRIMARY KEY AUTOINCREMENT,
  state TEXT NOT NULL DEFAULT 'prepared',  -- 'prepared', 'active', 'complete', 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  winning_team INTEGER,                    -- 1 or 2 (NULL until complete)
  voice_channel_id TEXT
);

CREATE INDEX idx_matches_state ON matches(state);
```

### match_participants

```sql
CREATE TABLE match_participants (
  match_id INTEGER NOT NULL,
  discord_user_id TEXT NOT NULL,
  team INTEGER NOT NULL,                -- 1 or 2
  PRIMARY KEY (match_id, discord_user_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (discord_user_id) REFERENCES players(discord_user_id)
);
```

### guild_config

```sql
CREATE TABLE guild_config (
  guild_id TEXT PRIMARY KEY,
  main_vc_id TEXT,
  team1_vc_id TEXT,
  team2_vc_id TEXT,
  auto_move INTEGER NOT NULL DEFAULT 1,  -- 1 = enabled, 0 = disabled
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Commands

### `/register`

Register for PUG matches.

**Parameters:**

- `battlenet` (string, required): BattleNet ID (e.g., Player#1234)
- `role` (choice, required): tank | dps | support
- `rank` (choice, required): bronze | silver | gold | platin | diamond | master | grandmaster

**Behavior:**

- Checks if user is already registered
- Saves player to database
- Sends ephemeral confirmation

**Output:**

```
Registered successfully!

BattleNet: Player#1234
Role: dps
Rank: diamond
```

### `/profile`

View your or another player's profile.

**Parameters:**

- `user` (user, optional): Player to view (defaults to self)

**Behavior:**

- Retrieves player data from database
- Displays stats and info

### `/update`

Update your registration information.

**Parameters:**

- Same as `/register` but all optional
- Updates only provided fields

### `/setup`

Configure bot settings (Admin only).

**Subcommands:**

#### `/setup mainvc`

Set the main voice channel (lobby where players wait).

**Parameters:**

- `channel` (voice channel, required)

#### `/setup team1vc`

Set Team 1 voice channel.

**Parameters:**

- `channel` (voice channel, required)

#### `/setup team2vc`

Set Team 2 voice channel.

**Parameters:**

- `channel` (voice channel, required)

#### `/setup automove`

Toggle automatic player movement to team VCs.

**Parameters:**

- `enabled` (boolean, required)

#### `/setup view`

View current server configuration.

**Output:**

```
Current Configuration:

Main VC: #Lobby
Team 1 VC: #Team-1
Team 2 VC: #Team-2
Auto-move: Enabled
```

### `/makepug`

Main matchmaking command with subcommands.

#### `/makepug create`

Create a new match with automatic player selection.

**Parameters:**

- `include` (user, optional): Force-include specific player(s)
- `exclude` (user, optional): Exclude specific player(s)

**Behavior:**

1. Check no prepared/active match exists
2. Get all registered players in main VC
3. Apply include/exclude filters
4. Run matchmaking algorithm
5. Create balanced teams
6. Save match as 'prepared'
7. Display teams with BattleNet IDs

**Output:**

```
Match Prepared! Use `/makepug start` to begin.

**Team 1:**
Tank: @Player1 (BattleTag#1234)
DPS: @Player2 (BattleTag#5678), @Player3 (BattleTag#9012)
Support: @Player4 (BattleTag#3456), @Player5 (BattleTag#7890)

**Team 2:**
Tank: @Player6 (BattleTag#1111)
DPS: @Player7 (BattleTag#2222), @Player8 (BattleTag#3333)
Support: @Player9 (BattleTag#4444), @Player10 (BattleTag#5555)

Copy BattleTags to create in-game lobby.
```

#### `/makepug start`

Start the prepared match.

**Behavior:**

1. Check prepared match exists
2. Move players to team VCs (if auto-move enabled)
3. Update match state to 'active'
4. Confirm match started

**Output:**

```
Match Started!

Players have been moved to their team voice channels.
Good luck and have fun!
```

#### `/makepug cancel`

Cancel the current prepared or active match.

**Behavior:**

1. Check match exists
2. Update match state to 'cancelled'
3. Set completed_at timestamp
4. Confirm cancellation

**Output:**

```
Match cancelled.
```

## Matchmaking Algorithm

### Phase 1: Validation & Filtering

1. **Check existing matches:**
    - Query: `SELECT * FROM matches WHERE state IN ('prepared', 'active')`
    - If found: fail with error

2. **Get players in main VC:**
    - Use Discord API to get all members in main voice channel
    - Filter to only registered players (check against players table)

3. **Apply manual filters:**
    - Add `include` players (if registered and in VC)
    - Remove `exclude` players

4. **Validate player count:**
    - If < 10 players: fail with error
    - If ≥ 10 players: continue

### Phase 2: Player Selection (Priority-Based)

**Calculate priority score for each eligible player:**

```javascript
priority_score = {
  never_played: Infinity,
  last_played: days_since_last_match * weight_factor
}
```

**Query for last played:**

```sql
SELECT MAX(matches.created_at) as last_played_at
FROM match_participants
JOIN matches ON match_participants.match_id = matches.match_id
WHERE matches.state = 'complete'
  AND match_participants.discord_user_id = ?
```

**Role composition validation:**

- Count available players by role
- Required: ≥2 tanks, ≥4 DPS, ≥4 support
- If insufficient: fail with composition error

**Select 10 players:**

1. Sort tanks by priority score → pick top 2
2. Sort DPS by priority score → pick top 4
3. Sort support by priority score → pick top 4

### Phase 3: Team Balancing

**Distribute players into two teams:**

**By role:**

- Team 1: 1 tank, 2 DPS, 2 support
- Team 2: 1 tank, 2 DPS, 2 support

**By rank balance:**

- Assign rank numerical values (bronze=1, silver=2, ..., grandmaster=7)
- Calculate average rank per team
- Use greedy algorithm to minimize rank difference between teams

**Algorithm approach:**

1. Sort players by rank (descending)
2. For each role group:
    - Assign highest-ranked player to team with lower total rank
    - Continue until all players assigned
3. Result: roughly balanced teams by rank

### Phase 4: Match Creation

1. **Create match record:**
   ```sql
   INSERT INTO matches (state, voice_channel_id)
   VALUES ('prepared', ?)
   ```

2. **Create participant records:**
   ```sql
   INSERT INTO match_participants (match_id, discord_user_id, team)
   VALUES (?, ?, ?)
   ```
   (Repeat for all 10 players)

3. **Display teams**

## Match State Flow

```
NULL
  ↓
[/makepug create]
  ↓
prepared
  ↓
[/makepug start]
  ↓
active
  ↓
[match completion command - future]
  ↓
complete

(At any point: [/makepug cancel] → cancelled)
```

## Error Messages

### `/makepug create`

- "A match is already prepared/active. Use `/makepug cancel` first or `/makepug start` to begin."
- "Not enough players in voice channel. Need 10+, found X."
- "Can't make balanced teams. Need 2+ tanks, 4+ DPS, 4+ support. Currently: X tanks, Y DPS, Z support."
- "Player @User is not registered. They must use `/register` first."
- "Main voice channel not configured. Use `/setup mainvc` first."

### `/makepug start`

- "No prepared match found. Use `/makepug create` first."
- "Match has already been started."

### `/makepug cancel`

- "No match to cancel."

### `/register`

- "You are already registered! Use `/update` to change your info."
- "Registration failed. Please try again."

### `/setup`

- "This command can only be used in a server."
- "No configuration found. Use `/setup` commands to configure the bot."

## Voice Channel Management

### Auto-Move (when enabled)

**On `/makepug start`:**

1. Get guild config for team VCs
2. For each player in Team 1:
    - Move to team1_vc
3. For each player in Team 2:
    - Move to team2_vc

**Implementation:**

```javascript
const member = await guild.members.fetch(userId);
await member.voice.setChannel(teamVcId);
```

**Error handling:**

- If player not in VC: skip (don't fail entire operation)
- If bot lacks permissions: log warning
- If VC doesn't exist: log error

## Future Enhancements

### Phase 2 (Not Implementing Now)

- ELO rating system
- Match completion with winner selection
- Automatic win/loss tracking
- Match history per player
- Leaderboards
- Statistics dashboard
- Avoid repeat matchups (track recent games)
- Weighted priority (configurable wait time multipliers)

### Phase 3 (Advanced)

- Queue system for waiting players
- Multiple concurrent matches
- Map selection
- Role queue (queue as specific role)
- Party system (queue with friends)
- Season/ranking system
- Web dashboard

## Technical Stack

- **Language:** TypeScript
- **Runtime:** Node.js 22.12.0+
- **Discord Library:** discord.js v14
- **Database:** SQLite (better-sqlite3)
- **Environment:** dotenv for config

## Development Commands

### Deploy slash commands

```bash
npx tsx src/deploy-commands.ts
```

### Run bot

```bash
npx tsx src/index.ts
```

### Database inspection

```bash
sqlite3 data/bot.db "SELECT * FROM players;"
sqlite3 data/bot.db "SELECT * FROM matches WHERE state = 'active';"
```

## Project Structure

```
discord-bot/
├── src/
│   ├── commands/
│   │   ├── register.ts
│   │   ├── profile.ts
│   │   ├── update.ts
│   │   ├── setup.ts
│   │   └── makepug.ts
│   ├── database/
│   │   ├── init.ts
│   │   ├── players.ts
│   │   ├── matches.ts
│   │   └── config.ts
│   ├── utils/
│   │   ├── matchmaking.ts
│   │   └── balancing.ts
│   ├── types/
│   │   └── index.ts
│   ├── deploy-commands.ts
│   └── index.ts
├── data/
│   └── bot.db
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

## Environment Variables

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_guild_id
```

## Implementation Priority

1. ✅ Database setup
2. ✅ `/register` command
3. ✅ `/setup` command
4. ✅ `/profile` command
5. ✅ `/update` command
6. **Next:** `/makepug create` (matchmaking algorithm)
7. **Next:** `/makepug start` (player movement)
8. **Next:** `/makepug cancel`
9. **Future:** Match completion system
10. **Future:** ELO system

---

**Last Updated:** November 17, 2025