import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { Client } from 'discord.js';
import { sendPugAnnouncement } from '../../src/utils/announcements';
import { setAnnouncementChannel, setPugRole } from '../../src/database/config';
import { closeTestDatabase, createTestDatabase } from '../setup/testUtils';

describe('PUG Announcements', () => {
    let db: Database.Database;
    let mockClient: any;
    let mockChannel: any;
    let mockGuild: any;
    let mockEvent: any;

    beforeEach(() => {
        db = createTestDatabase();

        // Setup mock text channel
        mockChannel = {
            isTextBased: jest.fn<() => boolean>(() => true),
            send: jest.fn<() => Promise<any>>().mockResolvedValue({} as any)
        };

        // Setup mock Discord event
        mockEvent = {
            url: 'https://discord.com/events/guild123/event456'
        };

        // Setup mock guild
        mockGuild = {
            scheduledEvents: {
                fetch: jest.fn<() => Promise<any>>().mockResolvedValue(mockEvent)
            }
        };

        // Setup mock client
        mockClient = {
            channels: {
                fetch: jest.fn<() => Promise<any>>().mockResolvedValue(mockChannel)
            },
            guilds: {
                fetch: jest.fn<() => Promise<any>>().mockResolvedValue(mockGuild)
            }
        } as unknown as Client;
    });

    afterEach(() => {
        closeTestDatabase(db);
        jest.clearAllMocks();
    });

    describe('scheduled announcement', () => {
        it('should send correct message format with role mention and event link', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime,
                    discordEventId: 'event456',
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel456');
            expect(mockChannel.send).toHaveBeenCalledWith(
                `Hey <@&role789>, a new PUG has been scheduled for <t:${timestamp}:F>. Mark your calendars!\n` +
                `Scheduled by: <@user123>\n\n` +
                `https://discord.com/events/guild123/event456`
            );
        });

        it('should send message without role mention if pug_role_id not configured', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            // No setPugRole call

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime,
                    discordEventId: 'event456',
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(mockChannel.send).toHaveBeenCalledWith(
                `Hey everyone, a new PUG has been scheduled for <t:${timestamp}:F>. Mark your calendars!\n` +
                `Scheduled by: <@user123>\n\n` +
                `https://discord.com/events/guild123/event456`
            );
        });

        it('should send message without event link if discordEventId is null', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime,
                    discordEventId: null,
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(mockGuild.scheduledEvents.fetch).not.toHaveBeenCalled();
            expect(mockChannel.send).toHaveBeenCalledWith(
                `Hey <@&role789>, a new PUG has been scheduled for <t:${timestamp}:F>. Mark your calendars!\n` +
                `Scheduled by: <@user123>`
            );
        });

        it('should send message without creator if createdBy not provided', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime,
                    discordEventId: null
                }
            );

            // Verify
            expect(mockChannel.send).toHaveBeenCalledWith(
                `Hey <@&role789>, a new PUG has been scheduled for <t:${timestamp}:F>. Mark your calendars!`
            );
        });

        it('should handle event fetch failure gracefully', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');
            mockGuild.scheduledEvents.fetch.mockRejectedValue(new Error('Event not found'));

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime,
                    discordEventId: 'event456',
                    createdBy: 'user123'
                }
            );

            // Verify - should still send message, just without event URL
            expect(mockChannel.send).toHaveBeenCalledWith(
                `Hey <@&role789>, a new PUG has been scheduled for <t:${timestamp}:F>. Mark your calendars!\n` +
                `Scheduled by: <@user123>`
            );
        });
    });

    describe('reminder_24h announcement', () => {
        it('should send 24h reminder with correct format', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'reminder_24h',
                {
                    pugId: 1,
                    scheduledTime,
                    discordEventId: 'event456'
                }
            );

            // Verify
            expect(mockChannel.send).toHaveBeenCalledWith(
                `<@&role789> Scheduled PUG in 24 hours!\n` +
                `Time: <t:${timestamp}:F>\n` +
                `Event: https://discord.com/events/guild123/event456\n`
            );
        });

        it('should send 24h reminder without event link if not provided', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'reminder_24h',
                {
                    scheduledTime,
                    discordEventId: null
                }
            );

            // Verify
            expect(mockChannel.send).toHaveBeenCalledWith(
                `<@&role789> Scheduled PUG in 24 hours!\n` +
                `Time: <t:${timestamp}:F>\n`
            );
        });
    });

    describe('reminder_1h announcement', () => {
        it('should send 1h reminder with correct format and extra text', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'reminder_1h',
                {
                    pugId: 1,
                    scheduledTime,
                    discordEventId: 'event456'
                }
            );

            // Verify
            expect(mockChannel.send).toHaveBeenCalledWith(
                `<@&role789> Scheduled PUG starting in 1 hour!\n` +
                `Time: <t:${timestamp}:F>\n` +
                `Event: https://discord.com/events/guild123/event456\n` +
                `\nGet ready to join the main voice channel!`
            );
        });
    });

    describe('cancelled announcement', () => {
        it('should send cancellation message with correct format', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');

            const scheduledTime = new Date('2025-12-25T18:00:00Z');
            const timestamp = Math.floor(scheduledTime.getTime() / 1000);

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'cancelled',
                {
                    scheduledTime,
                    discordEventId: 'event456'
                }
            );

            // Verify
            expect(mockChannel.send).toHaveBeenCalledWith(
                `<@&role789> The scheduled PUG for <t:${timestamp}:F> has been cancelled.`
            );
        });
    });

    describe('error handling', () => {
        it('should log warning and return when no config found', async () => {
            // Setup
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime: new Date(),
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'No announcement channel configured for guild guild123'
            );
            expect(mockClient.channels.fetch).not.toHaveBeenCalled();
            expect(mockChannel.send).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        it('should log warning and return when announcement_channel_id not set', async () => {
            // Setup
            setPugRole(db, 'guild123', 'role789'); // Set role but not channel
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime: new Date(),
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'No announcement channel configured for guild guild123'
            );
            expect(mockClient.channels.fetch).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        it('should log warning and return when channel is invalid', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            mockChannel.isTextBased.mockReturnValue(false); // Not a text channel
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime: new Date(),
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Invalid announcement channel for guild guild123'
            );
            expect(mockChannel.send).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        it('should log warning and return when channel fetch returns null', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            mockClient.channels.fetch.mockResolvedValue(null);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime: new Date(),
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Invalid announcement channel for guild guild123'
            );

            consoleWarnSpy.mockRestore();
        });

        it('should log error and return when send throws exception', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            setPugRole(db, 'guild123', 'role789');
            mockChannel.send.mockRejectedValue(new Error('Discord API error'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Execute
            await sendPugAnnouncement(
                mockClient,
                db,
                'guild123',
                'scheduled',
                {
                    scheduledTime: new Date(),
                    createdBy: 'user123'
                }
            );

            // Verify
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error sending scheduled announcement for guild guild123:'),
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('should never throw exceptions to caller', async () => {
            // Setup
            setAnnouncementChannel(db, 'guild123', 'channel456');
            mockClient.channels.fetch.mockRejectedValue(new Error('Network error'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Execute - should not throw
            await expect(
                sendPugAnnouncement(
                    mockClient,
                    db,
                    'guild123',
                    'scheduled',
                    {
                        scheduledTime: new Date(),
                        createdBy: 'user123'
                    }
                )
            ).resolves.toBeUndefined();

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });
});
