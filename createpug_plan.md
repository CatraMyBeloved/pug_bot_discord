# Discord PUG Bot - Complete System Plan

## Overview

A Discord bot for managing Pick-Up Games (PUGs) with automatic matchmaking, team balancing, and voice channel
management. The bot selects players from a voice channel based on priority (time since last match), creates
balanced teams, and manages match flow.

## Design Decisions

**Matchmaking:**
- Player selection based on time since last match (fairest for community play)
- Tie-breaking uses random selection when priority scores are equal
- Global team balancing algorithm for better rank distribution across teams
- No include/exclude parameters initially (deferred to Phase 2 for cleaner UX)

**Permissions:**
- Configurable PUG Leader role for match management
- Admins always have full permissions
- If no PUG Leader role set, only admins can manage matches

**Match Flow:**
- Voice channel validation before start (warn if players missing, but continue)
- Basic match completion command included in Phase 1
- Win/loss tracking deferred to Phase 2

## Match Configuration

- **Format:** 5v5 (10 players total)
- **Role Composition per Team:** 1 Tank, 2 DPS, 2 Support
- **Minimum Players Required:** 10+ registered players in main voice channel

## Database Schema

### players

```sql
CREATE TABLE players
(
    discord_user_id TEXT PRIMARY KEY,
    battlenet_id    TEXT    NOT NULL,
    role            TEXT    NOT NULL, -- 'tank', 'dps', 'support'
    rank            TEXT    NOT NULL, -- 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster'
    wins            INTEGER NOT NULL DEFAULT 0,
    losses          INTEGER NOT NULL DEFAULT 0,
    registered_at   DATETIME         DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_role ON players (role);
```

### matches

```sql
CREATE TABLE matches
(
    match_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    state            TEXT NOT NULL DEFAULT 'prepared', -- 'prepared', 'active', 'complete', 'cancelled'
    created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
    completed_at     DATETIME,
    winning_team     INTEGER,                          -- 1 or 2 (NULL until complete)
    voice_channel_id TEXT
);

CREATE INDEX idx_matches_state ON matches (state);
```

### match_participants

```sql
CREATE TABLE match_participants
(
    match_id        INTEGER NOT NULL,
    discord_user_id TEXT    NOT NULL,
    team            INTEGER NOT NULL, -- 1 or 2
    PRIMARY KEY (match_id, discord_user_id),
    FOREIGN KEY (match_id) REFERENCES matches (match_id),
    FOREIGN KEY (discord_user_id) REFERENCES players (discord_user_id)
);
```

### guild_config

```sql
CREATE TABLE guild_config
(
    guild_id              TEXT PRIMARY KEY,
    main_vc_id            TEXT,
    team1_vc_id           TEXT,
    team2_vc_id           TEXT,
    auto_move             INTEGER NOT NULL DEFAULT 1, -- 1 = enabled, 0 = disabled
    pug_leader_role_id    TEXT,                       -- Role allowed to manage matches
    announcement_channel_id TEXT,
    updated_at            DATETIME         DEFAULT CURRENT_TIMESTAMP
);
```

## Commands

### `/register`

Register for PUG matches.

**Parameters:**

- `battlenet` (string, required): BattleNet ID (e.g., Player#1234)
- `role` (choice, required): tank | dps | support
- `rank` (choice, required): bronze | silver | gold | platinum | diamond | master | grandmaster

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

#### `/setup pugleader`

Set the role allowed to manage matches (create/start/cancel).

**Parameters:**

- `role` (role, required)

**Behavior:**

- Sets which role can use `/makepug` commands
- Admin users can always use match commands regardless of role
- If not set, only admins can manage matches

#### `/setup view`

View current server configuration.

**Output:**

```
Current Configuration:

Main VC: #Lobby
Team 1 VC: #Team-1
Team 2 VC: #Team-2
Auto-move: Enabled
PUG Leader Role: @PUG Captain
Announcement Channel: #pug-announcements
```

### `/makepug`

Main matchmaking command with subcommands.

#### `/makepug create`

Create a new match with automatic player selection.

**Parameters:**

- None

**Behavior:**

1. Check user has permission (PUG Leader role or Administrator)
2. Check no prepared/active match exists
3. Get all registered players in main VC
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

1. Check user has permission (PUG Leader role or Administrator)
2. Check prepared match exists
3. Validate all players still in voice channel
   - If players missing: display warning with names but continue
4. Move players to team VCs (if auto-move enabled)
   - Skip players not in VC
5. Update match state to 'active'
6. Confirm match started

**Output:**

```
Match Started!

Players have been moved to their team voice channels.
Good luck and have fun!
```

#### `/makepug cancel`

Cancel the current prepared or active match.

**Behavior:**

1. Check user has permission (PUG Leader role or Administrator)
2. Check match exists
3. Update match state to 'cancelled'
4. Set completed_at timestamp
5. Confirm cancellation

**Output:**

```
Match cancelled.
```

### `/match`

Match management command with subcommands.

#### `/match complete`

Mark the current active match as complete.

**Parameters:**

- `winning_team` (choice, required): 1 | 2 | draw

**Behavior:**

1. Check user has permission (PUG Leader role or Administrator)
2. Check active match exists
3. Update match state to 'complete'
4. Set winning_team (NULL for draw)
5. Set completed_at timestamp
6. Confirm completion

**Output:**

```
Match completed!
Winning Team: Team 1

Note: Win/loss tracking will be added in Phase 2.
```

## Matchmaking Algorithm

### Phase 1: Validation & Filtering

1. **Check existing matches:**
    - Query: `SELECT * FROM matches WHERE state IN ('prepared', 'active')`
    - If found: fail with error

2. **Get players in main VC:**
    - Use Discord API to get all members in main voice channel
    - Filter to only registered players (check against players table)

3. **Validate player count:**
    - If < 10 players: fail with error
    - If ≥ 10 players: continue

### Phase 2: Player Selection (Priority-Based)

**Calculate priority score for each eligible player:**

```javascript
// Calculate days since last match
const lastMatch = queryLastMatch(userId);
const daysSince = lastMatch ? calculateDays(lastMatch) : Infinity;

// Tie-breaking: if multiple players have same priority, use random selection
priority_score = daysSince;
```

**Query for last played:**

```sql
SELECT MAX(matches.created_at) as last_played_at
FROM match_participants
         JOIN matches ON match_participants.match_id = matches.match_id
WHERE matches.state = 'complete'
  AND match_participants.discord_user_id = ?
```

**Tie-breaking:**

When multiple players have identical priority scores, use random selection to choose among them fairly.

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

**Target composition per team:**

- Team 1: 1 tank, 2 DPS, 2 support
- Team 2: 1 tank, 2 DPS, 2 support

**Global balancing algorithm:**

1. **Assign rank values:** bronze=1, silver=2, gold=3, platinum=4, diamond=5, master=6, grandmaster=7

2. **Sort all 10 players by rank (descending)**

3. **Balance using greedy assignment:**
   - For each player (starting with highest rank):
     - Check which team has lower total rank value
     - Try to assign player to lower-ranked team
     - Constraint: must maintain role composition (1 tank, 2 DPS, 2 support per team)
     - If role full on lower-ranked team, assign to other team

4. **Result:** Balanced teams with similar total rank values while maintaining role requirements

**Example:**
```
Players: GM tank, D tank, GM dps, D dps, D dps, D dps, GM sup, D sup, D sup, B sup
Team 1: GM tank (7), D dps (5), D dps (5), GM sup (7), B sup (1) = 25
Team 2: D tank (5), GM dps (7), D dps (5), D sup (5), D sup (5) = 27
Difference: 2 points
```

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
[/match complete]
  ↓
complete

(At any point: [/makepug cancel] → cancelled)
```

## Error Messages

### `/makepug create`

- "You don't have permission to manage matches. Ask an admin to set up PUG Leader role with `/setup pugleader`."
- "A match is already prepared/active. Use `/makepug cancel` first or `/makepug start` to begin."
- "Not enough players in voice channel. Need 10+, found X."
- "Can't make balanced teams. Need 2+ tanks, 4+ DPS, 4+ support. Currently: X tanks, Y DPS, Z support."
- "Main voice channel not configured. Use `/setup mainvc` first."

### `/makepug start`

- "You don't have permission to manage matches."
- "No prepared match found. Use `/makepug create` first."
- "Match has already been started."
- "⚠️ Warning: The following players have left the voice channel: @Player1, @Player2. Starting match anyway..."

### `/makepug cancel`

- "You don't have permission to manage matches."
- "No match to cancel."

### `/match complete`

- "You don't have permission to manage matches."
- "No active match found."
- "Match is not active. Current state: {state}"

### `/register`

- "You are already registered! Use `/update` to change your info."
- "Registration failed. Please try again."

### `/setup`

- "This command can only be used in a server."
- "No configuration found. Use `/setup` commands to configure the bot."

## Permissions

### PUG Leader Role

Commands that require PUG Leader permissions:
- `/makepug create`
- `/makepug start`
- `/makepug cancel`
- `/match complete`

**Permission check logic:**

```javascript
function hasMatchPermission(member, guildConfig) {
    // Admins always have permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    // Check if PUG Leader role is configured and user has it
    if (guildConfig.pug_leader_role_id) {
        return member.roles.cache.has(guildConfig.pug_leader_role_id);
    }

    // If no PUG Leader role configured, only admins can manage
    return false;
}
```

**Implementation location:** `src/utils/permissions.ts`

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

### Phase 2 (Deferred)

- Automatic win/loss tracking on match completion
- Match history per player
- Leaderboards by role/rank
- Statistics dashboard
- Avoid repeat matchups (track recent games)
- Include/exclude parameters for `/makepug create`

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
│   │   ├── roster.ts
│   │   ├── makepug.ts
│   │   ├── match.ts
│   │   ├── schedulepug.ts
│   │   ├── listpugs.ts
│   │   └── cancelpug.ts
│   ├── database/
│   │   ├── init.ts
│   │   ├── players.ts
│   │   ├── matches.ts
│   │   ├── config.ts
│   │   └── scheduled_pugs.ts
│   ├── services/
│   │   └── scheduler.ts
│   ├── utils/
│   │   ├── matchmaking.ts
│   │   ├── balancing.ts
│   │   └── permissions.ts
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

### Completed ✅
1. ✅ Database setup with initial schema
2. ✅ `/register` command
3. ✅ `/profile` command
4. ✅ `/update` command
5. ✅ `/setup` command (mainvc, team1vc, team2vc, automove, pugrole, announcementchannel, view)
6. ✅ `/roster` command
7. ✅ `/schedulepug` command with Discord event integration
8. ✅ `/listpugs` command
9. ✅ `/cancelpug` command with autocomplete
10. ✅ Scheduler service with 24h/1h reminders

### Phase 1: Core Match System (Current Focus)
11. **Next:** Add `pug_leader_role_id` to database schema
12. **Next:** Create `src/utils/permissions.ts` - helper for checking PUG leader permissions
13. **Next:** Create `src/database/matches.ts` - match CRUD operations
14. **Next:** Update `/setup` to add `pugleader` subcommand
15. **Next:** Create `src/utils/matchmaking.ts` - player selection algorithm
16. **Next:** Create `src/utils/balancing.ts` - global team balancing algorithm
17. **Next:** Create `/makepug create` command
18. **Next:** Create `/makepug start` command with VC validation
19. **Next:** Create `/makepug cancel` command
20. **Next:** Create `/match complete` command

### Phase 2: Win/Loss Tracking & Stats
21. **Future:** Automatic win/loss updates on match completion
22. **Future:** Match history per player
23. **Future:** Enhanced `/profile` with match history
24. **Future:** Leaderboards by role/rank
25. **Future:** Statistics dashboard

### Phase 3: Advanced Features
26. **Future:** ELO rating system
27. **Future:** Avoid repeat matchups (track recent games)
28. **Future:** Include/exclude parameters for `/makepug create`
29. **Future:** Queue system for waiting players
30. **Future:** Multiple concurrent matches
31. **Future:** Web dashboard

---

**Last Updated:** November 17, 2025