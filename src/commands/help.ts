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
                {name: 'Scheduled PUGs', value: 'scheduled'}
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
1. Configure voice channels:
   • \`/setup mainvc\` - Main lobby channel
   • \`/setup team1vc\` - Team 1 channel
   • \`/setup team2vc\` - Team 2 channel

2. Set up roles:
   • \`/setup pugrole\` - Role for PUG participants
   • \`/setup pugleader\` - Role allowed to create matches

3. Set announcement channel:
   • \`/setup announcementchannel\` - For scheduled PUG reminders

**That's it!** You're ready to start organizing PUGs.`;
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

**Voice Channel Setup:**
• \`/setup mainvc\` - Set the main lobby voice channel
• \`/setup team1vc\` - Set Team 1 voice channel
• \`/setup team2vc\` - Set Team 2 voice channel

**Role Setup:**
• \`/setup pugrole\` - Role for players who want to participate in PUGs
• \`/setup pugleader\` - Role allowed to create and manage matches

**Channel Setup:**
• \`/setup announcementchannel\` - Channel for PUG reminders and announcements

**Settings:**
• \`/setup automove\` - Toggle automatic player movement to team VCs
  - When enabled: Players are moved to team VCs when match starts
  - When disabled: Players manually join team VCs

**View Configuration:**
• \`/setup view\` - See current bot configuration

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

**Team Balancing (Rank System):**
Once 10 players are selected, teams are balanced by:

1. **Rank Values** - Each rank has a value (Bronze=1 to Grandmaster=7)
2. **Greedy Assignment** - Players assigned to team with lower total rank
3. **Role Enforcement** - Each team gets 1 tank, 2 DPS, 2 support

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
• Requires announcement channel configuration (\`/setup announcementchannel\`)`;
}
