/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/payment/webhook", (c) => {
    // 1. GUVENLIK KONTROLU (SECRET KEY)
    // RevenueCat'ten gelen "X-RevenueCat-Secret" header'ını kontrol et.
    // Env variable: RC_WEBHOOK_SECRET
    const incomingSecret = c.request().header.get("X-RevenueCat-Secret");
    const mySecret = $os.getenv("RC_WEBHOOK_SECRET");

    if (!mySecret) {
        // Sunucu config hatasi
        console.log("[PaymentWebhook] Error: RC_WEBHOOK_SECRET not set on server info.");
        return c.json(500, { error: "Server Configuration Error" });
    }

    if (incomingSecret !== mySecret) {
        console.log("[PaymentWebhook] Unauthorized attempt.");
        return c.json(401, { error: "Invalid Secret" });
    }

    // 2. DATA PARSING
    let body;
    try {
        const info = c.requestInfo();
        body = info.body; // PocketBase JSVM otomatk parse eder
    } catch (e) {
        return c.json(400, { error: "Invalid JSON" });
    }

    if (!body || !body.event) {
        return c.json(400, { error: "Missing event data" });
    }

    const event = body.event;
    const type = event.type; // INITIAL_PURCHASE, RENEWAL, NON_RENEWING_PURCHASE ...
    const appUserId = event.app_user_id; // PocketBase User ID'si olmalı
    const productId = event.product_id;

    console.log(`[PaymentWebhook] Event: ${type}, User: ${appUserId}, Product: ${productId}`);

    // Sadece basarili satin alimlari isliyoruz
    // (TEST olaylari için 'TEST' tipi gelebilir)
    const validTypes = ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE", "TEST"];

    if (!validTypes.includes(type)) {
        console.log(`[PaymentWebhook] Ignored event type: ${type}`);
        return c.json(200, { status: "ignored" });
    }

    // 3. KREDI MIKTARINI BELIRLE
    // Basit bir haritalama yapabiliriz veya ürün ID'sine gore
    // Örn: "credits_10" -> +10 kredi
    // "credits_50" -> +50 kredi

    let creditsToAdd = 0;

    if (productId.includes("credits_10")) creditsToAdd = 10;
    else if (productId.includes("credits_50")) creditsToAdd = 50;
    else if (productId.includes("credits_100")) creditsToAdd = 100;
    else if (productId.includes("pro_monthly")) creditsToAdd = 30; // Örnek: Aylık üyelikte her ay 30 kredi
    else {
        // Varsayılan / Bilinmeyen ürün
        console.log(`[PaymentWebhook] Unknown Product ID: ${productId}, defaulting to 0 credits.`);
        // Belki hata donmemeli, 200 dönüp loglamalı.
        return c.json(200, { status: "unknown_product" });
    }

    // 4. KULLANICIYI BUL VE GUNCELLE
    try {
        const user = $app.findRecordById("users", appUserId);
        const currentCredits = user.getInt("credits");
        const newBalance = currentCredits + creditsToAdd;

        user.set("credits", newBalance);
        $app.save(user); // Transaction gerekebilir ama basit kullanim icin ok.

        console.log(`[PaymentWebhook] SUCCESS! Added ${creditsToAdd} credits to user ${appUserId}. New Balance: ${newBalance}`);

        return c.json(200, { status: "success", added: creditsToAdd, new_balance: newBalance });

    } catch (dbErr) {
        console.log(`[PaymentWebhook] User not found or DB error: ${dbErr}`);
        // RevenueCat tekrar denesin diye 500 dönebiliriz, veya user yoksa yoksaymak için 200.
        // User yoksa yapacak bir şey yok, 200 dönüp kapatalım.
        return c.json(200, { status: "user_not_found_or_error", details: dbErr.toString() });
    }
});
