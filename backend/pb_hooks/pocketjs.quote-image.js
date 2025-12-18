/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/ai/quote-image-v2", (c) => {
    // Helper function inside handler scope
    function utf8ArrayToString(aBytes) {
        var out = "";
        var i = 0;
        var len = aBytes.length;
        while (i < len) {
            var c = aBytes[i++];
            if (c >> 4 < 8) out += String.fromCharCode(c);
            else if (c >> 4 < 14) out += String.fromCharCode(((c & 0x1F) << 6) | (aBytes[i++] & 0x3F));
            else out += String.fromCharCode(((c & 0x0F) << 12) | ((aBytes[i++] & 0x3F) << 6) | ((aBytes[i++] & 0x3F) << 0));
        }
        return out;
    }

    const debugLogs = [];
    const log = (m) => { console.log(m); debugLogs.push(m); };

    try {
        const info = c.requestInfo();
        const body = info.body;
        const authData = info.auth;
        const bookId = body.id;
        const contentId = body.contentId;
        log(`[Start] Book: ${bookId}, Content: ${contentId}`);

        if (!bookId) return c.json(400, { error: "bookId is required" });
        if (!contentId) return c.json(400, { error: "contentId is required" });
        if (!authData) return c.json(401, { error: "Authentication required" });

        // -------------------------------------------------------------------------
        // 1. KREDI KONTROLU
        // -------------------------------------------------------------------------
        let userRecord;
        try {
            const userId = authData.id || authData.getId();
            userRecord = $app.findRecordById("users", userId);

            if (userRecord.getInt("credits") < 1) {
                return c.json(402, {
                    error: "INSUFFICIENT_CREDITS",
                    message: "Yetersiz bakiye. Devam etmek için kredi yükleyin."
                });
            }
        } catch (err) {
            return c.json(500, { error: "User validation failed: " + err.message });
        }

        let book;
        try {
            book = $app.findRecordById("books", bookId);
            log(`[Book] Found: ${book.id}`);
        } catch (e) {
            log(`[Book] Not found: ${e}`);
            return c.json(404, { error: "Book not found", debugLogs });
        }

        // 2. JSON History'i Oku
        let contentList = [];
        try {
            const raw = book.get("generated_content");
            log(`[History] Raw type: ${typeof raw}`);
            if (raw) {
                let jsonStr = "";
                try { jsonStr = JSON.stringify(raw); } catch (e) { }

                let temp = null;
                try { temp = JSON.parse(jsonStr); } catch (e) { }

                if (Array.isArray(temp) && temp.length > 0 && typeof temp[0] === 'number') {
                    try {
                        const decodedStr = utf8ArrayToString(temp);
                        contentList = JSON.parse(decodedStr);
                        log(`[History] Decoded Byte Array. Len: ${contentList.length}`);
                    } catch (decodeErr) {
                        log(`[History] Decode Err: ${decodeErr}`);
                        contentList = [];
                    }
                } else if (Array.isArray(temp)) {
                    contentList = temp;
                } else if (temp) {
                    contentList = [temp];
                }
            }
        } catch (e) { log(`[History] Read Err: ${e}`); contentList = []; }

        if (!Array.isArray(contentList)) contentList = [];
        log(`[History] Final Len: ${contentList.length}`);

        // 3. İlgili Item'i Bul
        const itemInfo = contentList.find(c => c.id === contentId);
        if (!itemInfo) log(`[Item] Content ID ${contentId} not found in history!`);

        const imagePrompt = itemInfo ? itemInfo.imagePrompt : "Abstract artistic book scene";
        log(`[Prompt] Length: ${imagePrompt.length}`);

        // Prompt Temizligi
        const safePrompt = imagePrompt.replace(/[^a-zA-Z0-9\s,]/g, "").replace(/\s+/g, " ").trim().substring(0, 300);
        const encodedPrompt = encodeURIComponent(safePrompt);
        const seed = Math.floor(Math.random() * 100000);

        // 4. Resim Üret (Pollinations)
        const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=768&height=768&model=flux&seed=${seed}&nologo=true`;
        const pollinationKey = $os.getenv("POLLINATION_KEY");

        // Key yoksa bile Pollinations public çalışabilir ama yine de kontrol iyi olur
        if (!pollinationKey) {
            console.log("[Warn] POLLINATION_KEY is missing, trying without auth header or generic");
        }

        log(`[AI] Requesting...`);
        const res = $http.send({
            url: imageUrl,
            method: "GET",
            headers: pollinationKey ? { "Authorization": `Bearer ${pollinationKey}`, "User-Agent": "BookVault/1.0" } : { "User-Agent": "BookVault/1.0" },
            timeout: 60
        });
        log(`[AI] Status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
            return c.json(500, { error: "Image AI Failed", details: res.raw, debugLogs });
        }

        // 5. Dosyayi Kaydet
        const tmpImgPath = `/tmp/quote_${book.id}_${contentId}.jpg`;
        try {
            $os.writeFile(tmpImgPath, res.raw);
            log(`[OS] File written to ${tmpImgPath}`);
        } catch (e) {
            throw new Error("WriteFile Error: " + e);
        }

        try {
            const file = $filesystem.fileFromPath(tmpImgPath);
            book.set("generated_image", file); // Append (Multiple)
            book.set("image_gen_status", "completed");

            // Once dosya kaydi icin save
            $app.save(book);
            log(`[DB] Image saved to record`);

            // 6. Yeni Dosya Ismini Bul
            const updatedBook = $app.findRecordById("books", bookId);
            const savedFiles = updatedBook.get("generated_image");

            let newFileName = "";
            if (Array.isArray(savedFiles) && savedFiles.length > 0) {
                newFileName = savedFiles[savedFiles.length - 1]; // Son eklenen
                log(`[File] New filename: ${newFileName}`);
            } else if (typeof savedFiles === 'string') {
                newFileName = savedFiles;
            }

            if (newFileName) {
                const idx = contentList.findIndex(c => c.id === contentId);
                if (idx !== -1) {
                    contentList[idx].image = newFileName;
                    updatedBook.set("generated_content", contentList);
                    $app.save(updatedBook); // JSON update
                    log(`[DB] JSON updated`);
                } else {
                    log(`[DB] Item index not found for update`);
                }
            }

            try { $os.remove(tmpImgPath); } catch (e) { }

            // -------------------------------------------------------------------------
            // 7. KREDI DUSUR
            // -------------------------------------------------------------------------
            try {
                const currentCredits = userRecord.getInt("credits");
                userRecord.set("credits", currentCredits - 1);
                $app.save(userRecord);
                log(`[Credit] Deducted. Remaining: ${currentCredits - 1}`);
            } catch (e) {
                log(`[Credit] Failed to deduct: ${e}`);
                // Resim olusturuldu ama kredi dusulemedi, kritik degil devam et
            }

            const publicUrl = `/api/files/${book.collection().id}/${book.id}/${newFileName}`;

            return c.json(200, {
                status: "success",
                image_url: publicUrl,
                fileName: newFileName,
                remainingCredits: userRecord.getInt("credits"),
                debugLogs
            });

        } catch (err) {
            log(`[Save] Error: ${err}`);
            return c.json(500, { error: "File Save Error", details: err.toString(), debugLogs });
        }

    } catch (err) {
        return c.json(500, { error: err.toString(), details: err.message, debugLogs });
    }
});
