/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/mock/buy-credits", (c) => {
    // 1. DATA EXTRACTION
    let amount = 10;
    try {
        const info = c.requestInfo();
        const data = info.body || {};
        if (data.amount) {
            amount = parseInt(data.amount);
        }

        // 2. AUTH CHECK
        // Using robust info.auth check as established in recommendation.js
        const authData = info.auth;
        if (!authData) {
            return c.json(401, { error: "Authentication required" });
        }

        // 3. USER RECORD FETCH
        const userId = authData.id || authData.getId();

        // Use $app methods directly (avoiding .dao() error)
        const userRecord = $app.findRecordById("users", userId);

        // 4. UPDATE CREDITS
        const currentCredits = userRecord.getInt("credits");
        const newBalance = currentCredits + amount;

        userRecord.set("credits", newBalance);

        // 5. SAVE
        $app.save(userRecord);

        return c.json(200, {
            success: true,
            message: `${amount} kredi başarıyla yüklendi. (TEST)`,
            credits: newBalance
        });

    } catch (e) {
        return c.json(500, { error: "Payment processing failed: " + e.message });
    }
});
