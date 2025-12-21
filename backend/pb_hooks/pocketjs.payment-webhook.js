/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/payment/webhook", (c) => {
    try {
        const req = c.request;

        // 1. Secret Check (Authorization Header Öncelikli)
        let incomingSecret = req.header.get("Authorization");

        // "Bearer " prefix'i varsa temizle
        if (incomingSecret) {
            incomingSecret = incomingSecret.replace("Bearer ", "").trim();
        }

        // Yedek olarak eski custom header'a da bak
        if (!incomingSecret) {
            incomingSecret = req.header.get("X-RevenueCat-Secret");
        }

        const mySecret = $os.getenv("RC_WEBHOOK_SECRET");

        // Secret Validation
        if (mySecret && incomingSecret !== mySecret) {
            console.log(`[PaymentWebhook] UNAUTHORIZED: Secret mismatch.`);
            return c.json(401, { error: "Invalid Secret" });
        }

        // 2. Read Body
        // Use global readerToString with req.body property
        const rawBody = readerToString(req.body);
        if (!rawBody) {
            return c.json(400, { error: "Empty Body" });
        }

        // 3. Parse JSON
        let data;
        try {
            data = JSON.parse(rawBody);
        } catch (parseErr) {
            console.log("[PaymentWebhook] JSON Parse Error");
            return c.json(400, { error: "Invalid JSON" });
        }

        // 4. Process Event
        if (data && data.event) {
            const event = data.event;
            const appUserId = event.app_user_id;
            const productId = event.product_id || "";
            const type = event.type;

            // Only process purchase-related events
            const validTypes = ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE"];

            // TEST eventlerini de loglayip gecelim (Islem yapilmayacak ama hata donmeyecek)
            if (type === "TEST") {
                console.log("[PaymentWebhook] Test event received and acknowledged.");
                return c.json(200, { status: "test_acknowledged" });
            }

            if (!validTypes.includes(type)) {
                return c.json(200, { status: "ignored_event_type", type: type });
            }

            let creditsToAdd = 0;
            if (productId.includes("750_cr")) creditsToAdd = 750;
            else if (productId.includes("500_cr")) creditsToAdd = 500;
            else if (productId.includes("250_cr")) creditsToAdd = 250;

            // If no credits to add, just acknowledge
            if (creditsToAdd === 0) {
                return c.json(200, { status: "no_credits_assigned", product: productId });
            }

            let newBalance = -1;
            let statusMsg = "user_not_found";

            try {
                // Skip if user ID is anonymous or missing
                if (appUserId && !appUserId.startsWith("$RC_ANONYMOUS")) {
                    const user = $app.findRecordById("users", appUserId);
                    if (user) {
                        const current = user.getInt("credits");
                        newBalance = current + creditsToAdd;
                        user.set("credits", newBalance);
                        $app.save(user);
                        statusMsg = "success";
                        console.log(`[PaymentWebhook] SUCCESS: +${creditsToAdd} credits to User ${appUserId}. New Balance: ${newBalance}`);
                    }
                } else {
                    statusMsg = "anonymous_user_skipped";
                    console.log(`[PaymentWebhook] Skipped anonymous user: ${appUserId}`);
                }
            } catch (dbErr) {
                console.log(`[PaymentWebhook] DB Error (User: ${appUserId}):`, dbErr);
                // Return 200 to prevent RC from retrying indefinitely for invalid users
                statusMsg = "user_lookup_failed";
            }

            return c.json(200, {
                status: statusMsg,
                current_credits: newBalance
            });
        }

        return c.json(200, { status: "no_event_data" });

    } catch (e) {
        console.log("[PaymentWebhook] FATAL ERROR:", e);
        return c.json(500, { error: "Internal Server Error" });
    }
});
