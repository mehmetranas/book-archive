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

    // Helper to safely parse PB JSON fields which might be bytes, strings, or objects
    function safeParseJson(record, fieldName) {
        try {
            const raw = record.get(fieldName);
            if (!raw) return [];

            // If it's already an array (JSVM unwrapped)
            if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] !== 'number') {
                return raw;
            }

            // If it's a byte array (Uint8Array / Go slice)
            if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
                const str = utf8ArrayToString(raw);
                return JSON.parse(str);
            }

            // Case: It might be a string (stored as string in DB)
            if (typeof raw === 'string') {
                return JSON.parse(raw);
            }

            // Case: It's an object (map[string]interface{})
            if (typeof raw === 'object') {
                // Try round-trip to ensure it's clean JS object
                return JSON.parse(JSON.stringify(raw));
            }

            return [];
        } catch (e) {
            console.log(`[JSON Parse Error] Field: ${fieldName}, Error: ${e}`);
            return [];
        }
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
        } catch (e) {
            return c.json(404, { error: "Book not found", debugLogs });
        }

        // 2. JSON History'i Oku
        let contentList = safeParseJson(book, "generated_content");

        // Force array if it became a single object or null
        if (!Array.isArray(contentList)) {
            // If it parsed to a single object, wrap it
            if (contentList && typeof contentList === 'object') contentList = [contentList];
            else contentList = [];
        }

        log(`[History] Len: ${contentList.length}`);

        // 3. İlgili Item'i Bul
        const itemInfo = contentList.find(c => c.id === contentId);
        if (!itemInfo) log(`[Item] Content ID ${contentId} not found in history!`);

        // Eğer item bulunamadıysa bile resim üretmeye çalışıyoruz (Fallback prompt)
        const imagePrompt = itemInfo ? itemInfo.imagePrompt : "Artistic book cover design minimal";

        // Prompt Temizligi
        const safePrompt = imagePrompt.replace(/[^a-zA-Z0-9\s,]/g, "").replace(/\s+/g, " ").trim().substring(0, 300);
        const encodedPrompt = encodeURIComponent(safePrompt);
        const seed = Math.floor(Math.random() * 1000000);

        // 4. Resim Üret (Pollinations)
        const queryParams = `width=768&height=768&model=flux&seed=${seed}&nologo=true`;
        const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?${queryParams}`;

        let res;
        try {
            log(`[AI] Requesting image...`);

            // --- Pollinations AI Auth ---
            // Key'i environment'tan veya hardcoded olarak al (book-enrichment.js ile aynı mantık)
            const pollinationKey = $os.getenv("POLLINATION_KEY");
            const headers = {
                "User-Agent": "BookVault/1.0"
            };

            // Eğer key varsa ekle
            if (pollinationKey) {
                headers["Authorization"] = `Bearer ${pollinationKey}`;
            }

            res = $http.send({
                url: imageUrl,
                method: "GET",
                timeout: 60,
                headers: headers
            });
            log(`[AI] Response status: ${res.statusCode}`);
        } catch (netEx) {
            log(`[AI] Network Exception: ${netEx}`);
            return c.json(502, { error: "AI Service Network Error", details: netEx.toString(), debugLogs });
        }

        if (res.statusCode !== 200) {
            return c.json(500, { error: "Image AI Failed", statusCode: res.statusCode, details: res.raw, debugLogs });
        }

        // 5. Dosyayi Kaydet
        const tmpImgPath = `/tmp/quote_${book.id}_${contentId}_${new Date().getTime()}.jpg`;
        try {
            if (!res.raw) throw new Error("Empty response body");
            $os.writeFile(tmpImgPath, res.raw);
        } catch (e) {
            throw new Error("WriteFile Error: " + e);
        }

        try {
            // Note: In PB JSVM, creating a proper multipart/form-data upload simulation for existing record is tricky via valid 'set'.
            // However, $filesystem.fileFromPath normally works if mapped correctly.

            const file = $filesystem.fileFromPath(tmpImgPath);

            // Important: Updating the record with a new file.
            // If 'generated_image' is a multiple-file field, this usually APPENDS or ADDS to the list in recent PB versions when using '+' operator equivalent or set.
            // In safe logic, we just set it.
            book.set("generated_image", file);

            // Status update
            book.set("image_gen_status", "completed");

            // SAVE 1: Upload the file
            $app.save(book);

            log(`[DB] Image saved`);

            // 6. Dosya Ismini Al ve JSON Guncelle
            // Record'u tazeleyelim ki yeni dosya adini alabilelim
            const updatedBook = $app.findRecordById("books", bookId);
            const savedFiles = updatedBook.get("generated_image"); // Strings or array of strings

            let newFileName = "";
            if (Array.isArray(savedFiles) && savedFiles.length > 0) {
                newFileName = savedFiles[savedFiles.length - 1]; // Son dosya
            } else if (typeof savedFiles === 'string' && savedFiles.length > 0) {
                newFileName = savedFiles;
            }

            if (!newFileName) {
                // Fallback: file upload failed silently?
                log("[DB] Warning: No filename found after save.");
            } else {
                log(`[DB] New file: ${newFileName}`);

                // Content list'i tekrar bul (yukarıdaki contentList referansı bellekte)
                // Ama updatedBook üzerinden tekrar parse etmek daha güvenli olabilir, ancak biz yukarıda parse ettik ve değiştirmedik.
                // Sadece memorydeki listeyi güncelleyip kaydedelim.

                const idx = contentList.findIndex(c => c.id === contentId);
                if (idx !== -1) {
                    contentList[idx].image = newFileName;
                    updatedBook.set("generated_content", contentList);
                    $app.save(updatedBook); // SAVE 2: Update JSON
                    log(`[DB] JSON updated with filename`);
                } else {
                    log(`[DB] Content ID not found involved in JSON update, skipping link.`);
                }
            }

            try { $os.remove(tmpImgPath); } catch (e) { }

            // 7. KREDI DUSUR
            try {
                const currentCredits = userRecord.getInt("credits");
                userRecord.set("credits", currentCredits - 1);
                $app.save(userRecord);
            } catch (e) {
                log(`[Credit] Failed to deduct: ${e}`);
            }

            const publicUrl = `/api/files/${book.collection().id}/${book.id}/${newFileName}`;

            return c.json(200, {
                status: "success",
                image_url: publicUrl,
                fileName: newFileName,
                remainingCredits: userRecord.getInt("credits") - 1,
                debugLogs
            });

        } catch (err) {
            log(`[Save] Data Error: ${err}`);
            // Clean up temp
            try { $os.remove(tmpImgPath); } catch (e) { }
            return c.json(500, { error: "Database Save Error", details: err.toString(), debugLogs });
        }

    } catch (err) {
        return c.json(500, { error: "Internal Server Error", details: err.toString(), debugLogs });
    }
});
