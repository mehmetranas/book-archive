routerAdd("POST", "/api/mock/buy-credits", (c) => {
    const user = c.get("authRecord");
    if (!user) {
        return c.json(401, { error: "Authentication required" });
    }

    const data = c.requestInfo().body;
    const amount = data.amount || 10; // Default to 10 credits

    // Update credits
    const current = user.getInt("credits");
    const newBalance = current + amount;

    user.set("credits", newBalance);
    $app.dao().saveRecord(user);

    return c.json(200, {
        success: true,
        message: `${amount} kredi başarıyla yüklendi. (TEST)`,
        credits: newBalance
    });
});
