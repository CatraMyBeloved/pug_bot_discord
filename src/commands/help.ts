import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import Database from 'better-sqlite3';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn how to use the PUG bot')
    .addStringOption(option =>
        option
            .setName('topic')
            .setDescription('Get help on a specific topic')
            .setRequired(false)
            .addChoices(
                {name: 'Getting Started', value: 'start'},
                {name: 'Player Commands', value: 'player'},
                {name: 'PUG Leader Commands', value: 'leader'},
                {name: 'Admin Commands', value: 'admin'},
                {name: 'How Matchmaking Works', value: 'matchmaking'},
                {name: 'Scheduled PUGs', value: 'scheduled'},
                {name: 'Leaderboard', value: 'leaderboard'}
            )
    );

export async function execute(
    interaction: ChatInputCommandInteraction,
    db: Database.Database
) {
    const topic = interaction.options.getString('topic');

    let content: string;

    switch (topic) {
        case 'start':
            content = getStartContent();
            break;
        case 'player':
            content = getPlayerContent();
            break;
        case 'leader':
            content = getLeaderContent();
            break;
        case 'admin':
            content = getAdminContent();
            break;
        case 'matchmaking':
            content = getMatchmakingContent();
            break;
        case 'scheduled':
            content = getScheduledContent();
            break;
        case 'leaderboard':
            content = getLeaderboardContent();
            break;
        default:
            content = getOverviewContent();
            break;
    }

    await interaction.reply({
        content: content,
        flags: MessageFlags.Ephemeral,
    });
}

function getOverviewContent(): string {
    return `**Overwatch 2 PUG Bot**

This bot helps organize Pick-Up Games (PUGs) with automatic team balancing!

**Quick Topics:**
Use \`/help topic:<name>\` to learn more:
• **Getting Started** - First time setup
• **Player Commands** - Commands for all players
• **PUG Leader Commands** - Create and manage matches
• **Admin Commands** - Server configuration
• **How Matchmaking Works** - Team selection algorithm
• **Scheduled PUGs** - Schedule matches in advance
• **Leaderboard** - View top players

**Need Help?**
Contact your server administrators if you have questions!`;
}

function getStartContent(): string {
    return `**Getting Started**

**For Players:**
1. **Register** with \`/register\`
   • Provide your BattleNet ID (e.g., Player#1234)
   • Select your roles: tank, dps, or support (can select multiple!)
   • Choose your current competitive rank

2. **Join the main voice channel** when a PUG is happening

3. **Wait for a PUG leader** to create teams with \`/makepug create\`

**For Admins (First Time Setup):**
1. **Run the Setup Wizard:**
   • \`/setup\` - Launches an interactive wizard to configure everything

2. **Configure Through the Wizard:**
   • Select voice channels (Main VC, Team 1 VC, Team 2 VC) from dropdowns
   • Set roles (PUG Participant, PUG Leader) using role selectors
   • Configure announcement channel for scheduled PUG reminders
   • Toggle auto-move setting (automatically move players to team VCs)

3. **Review and Confirm:**
   • The wizard shows a review screen before saving
   • All changes are saved atomically when you confirm

**That's it!** No need to copy/paste channel IDs or enable Developer Mode.`;
}

function getPlayerContent(): string {
    return `**Player Commands**

**\`/register\`**
Register for PUG matches. Required before you can play!
• \`battlenet\`: Your BattleNet ID (e.g., Player#1234)
• \`roles\`: Roles you play (tank, dps, support - separate with commas)
• \`rank\`: Your competitive rank (Bronze through Grandmaster)

**\`/update\`**
Update your registration info (BattleNet ID, roles, or rank).

**\`/profile\`**
View your PUG stats and registration info.
• Shows your roles, rank, and win/loss record

**\`/leaderboard\`**
View the top players ranked by performance.
• \`limit\`: Number of players to show (default: 10)
• \`mingames\`: Minimum games required (default: 3)

**\`/roster\`**
See all registered players in the server.

**\`/listpugs\`**
View all upcoming scheduled PUG matches.

**Tips:**
• You can register for multiple roles! (e.g., \`tank,support\`)
• Keep your rank updated for better team balance
• Join the main VC when you want to play`;
}

function getLeaderContent(): string {
    return `**PUG Leader Commands**

*Requires PUG Leader role or Administrator permission*

**\`/makepug create\`**
Creates balanced teams from players in the main voice channel.
• Requires 10+ registered players in main VC
• Automatically selects 10 players and assigns roles
• Balances teams by rank
• Shows team composition with BattleTags

**\`/makepug start\`**
Starts the prepared match.
• Optionally moves players to team voice channels (if auto-move enabled)
• Changes match state to "active"

**\`/makepug cancel\`**
Cancels the current prepared or active match.

**\`/match complete\`**
Marks the active match as complete.
• \`winning_team\`: Team 1, Team 2, or Draw
• Updates player win/loss records

**Match Flow:**
1. Players join main VC
2. \`/makepug create\` - Creates teams
3. \`/makepug start\` - Starts match
4. Play your game!
5. \`/match complete\` - Record the result`;
}

function getAdminContent(): string {
    return `**Admin Commands**

*Requires Administrator permission*

**Configuration:**
• \`/setup\` - Interactive wizard to configure the bot
  - Set voice channels (Main, Team 1, Team 2)
  - Configure roles and permissions
  - Set announcement channel
  - Toggle auto-move functionality

**Maintenance:**
• \`/setup-reset\` - Reset ALL bot configuration for the server
  - **Warning:** This cannot be undone!

**Troubleshooting:**
• \`/test\` - Test bot functionality
  - \`all\`: Run all tests
  - \`read\`: Test reading voice channel members
  - \`move\`: Test moving yourself through voice channels

**Schedule PUGs:**
• \`/schedulepug\` - Schedule a PUG match for a future time
  - Creates Discord event
  - Sends reminders 24h and 1h before
  - \`date\`: YYYY-MM-DD format
  - \`hour\`: 0-23 (UTC timezone)
  - \`minute\`: 00, 15, 30, or 45

**Manage Scheduled PUGs:**
• \`/listpugs\` - View upcoming scheduled PUGs
• \`/cancelpug\` - Cancel a scheduled PUG`;
}

function getMatchmakingContent(): string {
    return `**How Matchmaking Works**

**Player Selection (Priority System):**
The bot selects 10 players from those in the main voice channel based on:

1. **Time Since Last Match** - Players who haven't played recently get priority
2. **Role Availability** - Ensures proper composition (2 tanks, 4 DPS, 4 supports)
3. **Selection Order** - Scarce roles filled first (tanks → supports → DPS)

**Team Balancing (TrueSkill System):**
The bot uses an advanced V2 Optimization algorithm:

1. **TrueSkill Ratings** - Each player has a skill rating (μ) based on match history
2. **Smart Optimization** - Evaluates 1,350+ possible team combinations
3. **Balanced Weighting** - 80% priority fairness, 20% skill fairness
4. **Role Enforcement** - Each team gets 1 tank, 2 DPS, 2 support

**Multi-Role System:**
• Players can register for multiple roles
• During selection, you're assigned ONE role per match
• Algorithm picks the role needed for balanced teams

**Requirements:**
• Minimum 10 registered players in main VC
• At least 2 players who can play tank
• At least 4 players who can play DPS
• At least 4 players who can play support

**Result:**
Two balanced teams with similar average rank and proper role composition!`;
}

function getScheduledContent(): string {
    return `**Scheduled PUGs**

Schedule PUG matches in advance with automatic reminders!

**How to Schedule:**
Use \`/schedulepug\` (Admin only):
• \`date\`: YYYY-MM-DD (e.g., 2025-01-20)
• \`hour\`: 0-23 (UTC timezone - check your offset!)
• \`minute\`: 00, 15, 30, or 45
• \`description\`: Optional event name

**What Happens:**
1. **Discord Event Created** - Shows up in server events
2. **Database Entry** - Tracked by the bot
3. **24-Hour Reminder** - Posted to announcement channel
4. **1-Hour Reminder** - Posted to announcement channel
5. **Auto-Cleanup** - Past events marked as completed

**Reminders Include:**
• Mention of PUG role (if configured)
• Event time in each user's timezone
• Link to Discord event
• Reminder to join main voice channel

**Managing Scheduled PUGs:**
• \`/listpugs\` - View all upcoming PUGs
• \`/cancelpug\` - Cancel a scheduled PUG (Admin only)

**Important Notes:**
• Times are entered in **UTC** timezone
• Discord shows times in each user's local timezone
• Must schedule at least 2 hours in advance
• Requires announcement channel configuration (use \`/setup\` wizard)`;
}

function getLeaderboardContent(): string {
    return `**Leaderboard**

View the top performing players in the server!

**Command:**
\`/leaderboard\`

**Options:**
• \`limit\`: Number of players to display (default: 10, max: 25)
• \`mingames\`: Minimum games played to qualify (default: 3)

**Ranking System:**
• Players are ranked by **Skill Rating (SR)**
• SR is calculated based on wins, losses, and individual performance
• Win rate is also displayed for reference

**Stats Displayed:**
• Rank (🥇, 🥈, 🥉, etc.)
• BattleTag
• SR (Skill Rating)
• Win/Loss Record
• Win Percentage
• Total Games Played`;
}
