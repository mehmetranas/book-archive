/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/payment/webhook", (c) => {
    try {
        // PocketBase JSVM (v0.23+) c.request is a PROPERTY, not a function!
        // This was the root cause of "Not a function" errors.
        const req = c.request;

        // 1. Secret Check
        // RevenueCat Dashboard'da "Authorization header value" kutusu kullanıldığı için
        // öncelik Authorization header'ındadır.
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

        if (mySecret && incomingSecret !== mySecret) {
            console.log(`[PaymentWebhook] SECRET FAIL. Expected: ${mySecret}, Got: ${incomingSecret}`);
            return c.json(401, { error: "Invalid Secret" });
        }

        // 2. Read Body
        // Use global readerToString with req.body property
        const rawBody = readerToString(req.body);
        if (!rawBody) {
            return c.json(400, { error: "Empty Body" });
        }

        const data = JSON.parse(rawBody);
        console.log(`[PaymentWebhook] Event Received: ${data?.event?.type} | Product: ${data?.event?.product_id}`);

        // 3. Process Event
        if (data.event) {
            const event = data.event;
            const appUserId = event.app_user_id;
            const productId = event.product_id || "";
            const type = event.type;

            // Only process purchase-related events
            const validTypes = ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE", "TEST", "PRODUCT_CHANGE"];
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
                        console.log(`[PaymentWebhook] CREDITS ADDED: ${creditsToAdd} to User ${appUserId}. New Balance: ${newBalance}`);
                    }
                } else {
                    statusMsg = "anonymous_user_skipped";
                }
            } catch (dbErr) {
                console.log(`[PaymentWebhook] DB Error (User: ${appUserId}):`, dbErr);
                // Return 200 to prevent RC from retrying indefinitely for invalid users
                statusMsg = "user_lookup_failed";
            }

            return c.json(200, {
                status: statusMsg,
                added_credits: creditsToAdd,
                new_balance: newBalance
            });
        }

        return c.json(200, { status: "no_event_data" });

    } catch (e) {
        console.log("[PaymentWebhook] FATAL ERROR:", e);
        return c.json(500, { error: "Webhook Processing Failed", details: e.toString() });
    }
});
