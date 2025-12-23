import { ButtonInteraction, InteractionEditReplyOptions, ModalSubmitInteraction } from 'discord.js';

/**
 * Executes an async operation with proper interaction timeout handling.
 *
 * This helper prevents bot crashes from expired interactions by:
 * 1. Deferring the interaction immediately (extends timeout from 3s to 15min)
 * 2. Executing the provided operation
 * 3. Safely updating the interaction with success/error messages (catches expired interaction errors)
 *
 * Use this for any button/modal handler that performs slow operations (database writes, API calls, etc.)
 *
 * @param interaction The button or modal interaction to handle
 * @param operation The async operation to execute (e.g., database writes)
 * @param successOptions The message/options to show on success
 * @param errorOptions The message/options to show on error
 * @param errorLogger Optional custom error logger (defaults to console.error)
 *
 * @example
 * await executeDeferredOperation(
 *   interaction,
 *   async () => {
 *     db.prepare('DELETE FROM users WHERE id = ?').run(userId);
 *   },
 *   { content: 'Success!', embeds: [], components: [] },
 *   { content: 'Failed!', embeds: [], components: [] }
 * );
 */
export async function executeDeferredOperation(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    operation: () => Promise<void>,
    successOptions: InteractionEditReplyOptions,
    errorOptions: InteractionEditReplyOptions,
    errorLogger: (message: string, error: unknown) => void = (msg, err) => console.error(msg, err)
): Promise<void> {
    // Defer immediately to prevent 3-second timeout
    await interaction.deferUpdate();

    try {
        // Execute the operation
        await operation();

        // Try to update with success message
        try {
            await interaction.editReply(successOptions);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Failed to send success message (interaction expired):', message);
        }
    } catch (error) {
        errorLogger('Operation failed:', error);

        // Try to update with error message
        try {
            await interaction.editReply(errorOptions);
        } catch (updateError) {
            const message = updateError instanceof Error ? updateError.message : String(updateError);
            console.error('Failed to send error message (interaction expired):', message);
        }
    }
}
