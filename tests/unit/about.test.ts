import {execute} from '../../src/commands/about';
import {ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import Database from 'better-sqlite3';

describe('About Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockDb: Database.Database;

    beforeEach(() => {
        mockInteraction = {
            reply: jest.fn(),
            valueOf: jest.fn(),
        } as unknown as ChatInputCommandInteraction;
        mockDb = {} as Database.Database;
    });

    it('should reply with an embed containing bot info', async () => {
        await execute(mockInteraction as ChatInputCommandInteraction, mockDb);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.any(EmbedBuilder)
                ]),
                flags: expect.any(Number)
            })
        );

        const callArgs = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
        const embed = callArgs.embeds[0];

        expect(embed.data.title).toContain('Overwatch 2 PUG Bot');
        expect(embed.data.fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({name: 'Core Capabilities'}),
                expect.objectContaining({name: 'Matchmaking Engine'}),
                expect.objectContaining({name: 'Key Commands'})
            ])
        );
    });
});
