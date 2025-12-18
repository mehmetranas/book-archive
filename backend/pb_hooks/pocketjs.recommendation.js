/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/ai/recommend-books", (c) => {
    const info = c.requestInfo();
    const data = info.body;
    const userQuery = data.query;

    if (!userQuery || userQuery.length < 5) {
        return c.json(400, { error: "Query too short" });
    }

    const pollinationKey = $os.getenv("POLLINATION_KEY");
    if (!pollinationKey) {
        return c.json(500, { error: "Server misconfiguration: POLLINATION_KEY missing" });
    }

    const prompt = `
### ROLE
You are a Literary Concierge and Expert Librarian AI. Your goal is to recommend books based on a user's free-text request.

### INPUT
User Request: "${userQuery}"

### CONSTRAINTS
1. **OFF-TOPIC CHECK**: If the user's request is NOT about finding a book (e.g., asking about coding, politics, recipes, general chat, or movies without a book context), return a JSON with "error": "OFF_TOPIC". Do NOT recommend anything.
2. **STRICT JSON**: Output must be a SINGLE valid JSON object. No markdown, no preambles.
3. **LANGUAGE**: The 'reason' and 'summary' fields MUST be in TURKISH.
4. **QUANTITY**: Recommend exactly 3 books.

### JSON STRUCTURE (Success)
{
  "recommendations": [
    {
      "title": "Exact Book Title",
      "author": "Author Name",
      "isbn": "9781234567890", // Best guess ISBN-13 if known, else null
      "reason": "Expert explanation of why this fits the request (in Turkish).",
      "summary": "Short plot summary (in Turkish)."
    }
  ]
}

### JSON STRUCTURE (Off-Topic)
{
  "error": "OFF_TOPIC",
  "message": "Üzgünüm, sadece kitap önerileri konusunda yardımcı olabilirim."
}

### FINAL VERIFICATION & SANITY CHECK (CRITICAL)
Before outputting the final JSON, perform this internal "Self-Correction" loop:
1. **Analyze Intent:** Did the user specifically ask for a *book*, *reading material*, *novel*, or *literature*?
   - If the user asked for a "movie", "song", or "code snippet", this is OFF_TOPIC.
2. **Verify Output:** Are the items you selected actually published books? Ensure they are not movies or video games with the same name.
3. **Decision Gate:**
   - IF the input is even slightly irrelevant to reading/books -> Force the "OFF_TOPIC" JSON.
   - ONLY IF the input is confirmed to be a book request -> Output the "recommendations" JSON.

### EXAMPLES

**Input:** "Bana zaman yolculuğu içeren ama romantik bir kitap öner."
**Output:**
{
  "recommendations": [
    {
      "title": "Zaman Yolcusunun Karısı",
      "author": "Audrey Niffenegger",
      "isbn": "9789759915678",
      "reason": "Zaman yolculuğu ve aşk temasını en iyi harmanlayan modern klasiklerden biridir. İstediğiniz hem bilimkurgu hem romantizm dengesini kurar.",
      "summary": "Henry, genetik bir bozukluk nedeniyle kontrolsüzce zamanda yolculuk yapar. Clare ise onun geçmişini ve geleceğini bilen eşidir. Sıradışı bir aşk hikayesi."
    },
    {
      "title": "11/22/63",
      "author": "Stephen King",
      "isbn": "9789752115044",
      "reason": "Zaman yolculuğu ile tarihi değiştirmeye çalışan bir adamın hikayesi, ancak içinde çok güçlü bir aşk hikayesi de barındırır.",
      "summary": "Bir öğretmen, JFK suikastını önlemek için geçmişe gider, ancak geçmiş değişmek istemez. Bu sırada geçmişte bulduğu aşk, görevini zorlaştırır."
    },
    {
      "title": "Yabancı",
      "author": "Diana Gabaldon",
      "isbn": "9789751016908",
      "reason": "Tarihi zaman yolculuğu ve tutkulu bir aşk hikayesi arayanlar için mükemmel bir seridir.",
      "summary": "1945 yılında yaşayan bir hemşire, gizemli bir taş çemberinden geçerek 1743 İskoçya'sına düşer ve orada bir savaşçıya aşık olur."
    }
  ]
}

**Input:** "Python ile nasıl backend yazarım?"
**Output:**
{
  "error": "OFF_TOPIC",
  "message": "Üzgünüm, ben bir kütüphaneciyim. Sadece kitap önerilerinde yardımcı olabilirim."
}

**Input:** "Batman izlemek istiyorum."
**Output:** (Internal check: User asked to 'watch', not 'read'. This is OFF_TOPIC.)
{
  "error": "OFF_TOPIC",
  "message": "Üzgünüm, ben bir kütüphaneciyim. Sadece kitap önerilerinde yardımcı olabilirim."
}
    `;

    try {
        const encodedPrompt = encodeURIComponent(prompt.trim());
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=gemini-search&seed=${seed}`;

        const res = $http.send({
            url: url,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pollinationKey}`,
                "Content-Type": "application/json"
            },
            timeout: 60 // 1 minute timeout
        });

        if (res.statusCode !== 200) {
            throw new Error("AI Provider Error: " + res.raw);
        }

        let rawText = res.raw;
        // Clean markdown
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        // Extract JSON
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            rawText = rawText.substring(firstBrace, lastBrace + 1);
        }

        const jsonResponse = JSON.parse(rawText);
        return c.json(200, jsonResponse);

    } catch (err) {
        return c.json(500, { error: err.message });
    }
});
