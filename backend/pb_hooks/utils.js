// This file is intended to be required, not executed directly.
// In PocketBase, all .js files in pb_hooks root are executed.
// To use this as a module, we should ideally move it to a subdirectory.
// For now, we'll wrap it to avoid errors if executed directly.

if (typeof module !== 'undefined') {
    module.exports = {
        /**
         * Checks if the user has enough credits.
         * @param {models.Record} user - The user record.
         * @param {number} cost - The credit cost.
         * @returns {number} The current credits.
         * @throws {Error} If credits are insufficient.
         */
        checkCredits: (user, cost) => {
            const current = user.getInt("credits");
            if (current < cost) {
                // Throw a specific error object or string we can catch
                throw new Error("INSUFFICIENT_CREDITS");
            }
            return current;
        },

        /**
         * Deducts credits from the user and saves the record.
         * @param {models.Record} user - The user record.
         * @param {number} cost - The credit cost.
         * @returns {number} The remaining credits.
         */
        deductCredits: (user, cost) => {
            const current = user.getInt("credits");
            if (current < cost) {
                throw new Error("INSUFFICIENT_CREDITS");
            }

            const newBalance = current - cost;
            user.set("credits", newBalance);
            $app.dao().saveRecord(user);

            return newBalance;
        }
    };
}
