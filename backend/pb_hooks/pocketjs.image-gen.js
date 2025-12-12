/// <reference path="../pb_data/types.d.ts" />

console.log("--> Image Gen Worker (STORAGE MODE) Hazir...");

cronAdd("image_gen_job", "* * * * *", () => {

    // Base64 Decode Polyfill (PocketBase/Goja için)
    function base64Decode(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let output = '';
        str = String(str).replace(/=+$/, '');
        for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++);) {
            if (~(buffer = chars.indexOf(buffer))) {
                bs = bc % 4 ? bs * 64 + buffer : buffer;
                if (bc++ % 4) output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
            }
        }
        const len = output.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = output.charCodeAt(i);
        }
        return bytes;
    }

    const apiKey = $os.getenv("GEMINI_IMAGE_KEY");
    if (!apiKey) {
        // console.log("[ImageJob] SKIP: GEMINI_KEY eksik");
        return;
    }

    try {
        // 1. Bekleyen işleri bul
        const records = $app.findRecordsByFilter(
            "books",
            "image_gen_status = 'pending'",
            "-created",
            5
        );

        if (records.length === 0) return;

        console.log(`[ImageJob] ${records.length} adet resim islenecek...`);

        records.forEach((book) => {
            book.set("image_gen_status", "processing");
            $app.save(book);

            const bookTitle = book.get("title");
            console.log(`[ImageJob] Isleniyor: ${bookTitle}`);

            try {
                // --- PROMPT HAZIRLIĞI ---
                const masterPrompt = `
Roleplay as an expert "Bookstagram" photographer and literary curator. I will provide you with a book title. Your task is to create a stunning, atmospheric Instagram post image (square aspect ratio 1:1) based on that book.

Follow these steps precisely:

1. QUOTE SELECTION: Select the most iconic, recognizable, and profound quote from the given book. If it is not already in Turkish, translate it accurately into the Turkish language.

2. MOOD ANALYSIS: Analyze the emotional weight, setting, and central theme of that specific quote and the book itself.

3. VISUAL TRANSLATION: Translate that specific mood into visual elements (Setting, Lighting, Props surrounding the book).

4. COMPOSITION & TYPOGRAPHY (HANDWRITTEN FOCUS):



Centerpiece: The image must feature an open, aged book with blank, textured, off-white pages or a piece of high-quality artisanal paper as the main focus.

The Quote (Crucial): The selected Turkish quote must be rendered as authentic, natural-looking handwriting. It must look genuinely written by a human hand directly onto the page using a traditional fountain pen or dip pen with dark ink. Show realistic details like slight ink texture, pressure variations, or minor imperfections that make it look organic, not printed. The script style should be elegant but personal.

Placement & Size: The handwritten quote must be perfectly centered both vertically and horizontally on the page. The size of the handwriting must be prominent and large enough to be effortlessly readable at a glance on a small screen.

The Book Title: Strictly position the book title in the bottom-right corner using a smaller, clean, non-italicized standard serif font (like EB Garamond) to contrast cleanly with the handwritten element.

Overall Style: The image should be a high-quality, cozy photographic "flat lay" scene.

CREATE THE IMAGE FOR THE BOOK: ${bookTitle}
`;
                // --- API ÇAĞRISI ---
                // Gemini 3 Pro Image Preview modelini kullanıyoruz (Test edilen model)
                const modelUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=" + apiKey;

                // API isteği gönderiliyor
                const imageRes = $http.send({
                    url: modelUrl,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: masterPrompt }] }],
                        generationConfig: {
                            responseModalities: ["IMAGE"]
                        }
                    }),
                    timeout: 60
                });

                if (imageRes.statusCode !== 200) {
                    throw new Error(`API Hatasi (${imageRes.statusCode}): ${imageRes.raw}`);
                }

                // Gelen yanıtı parse et
                const responseData = imageRes.json;

                // Gemini Response Parsing (Candidates -> Content -> Parts -> InlineData)
                let base64String = "";

                if (responseData.candidates && responseData.candidates.length > 0) {
                    const parts = responseData.candidates[0].content.parts;
                    for (const part of parts) {
                        if (part.inlineData && part.inlineData.mimeType.startsWith("image")) {
                            base64String = part.inlineData.data;
                            break;
                        }
                    }
                }

                if (!base64String) {
                    throw new Error("API yanitinda Base64 veri bulunamadi (Gecersiz Yanit Yapisi).");
                }

                // --- LINUX GÜCÜYLE DOSYA OLUŞTURMA ---

                // Geçici dosya yolları
                const tmpBase64Path = `/tmp/${book.id}_base64.txt`;
                const tmpImagePath = `/tmp/${book.id}_image.jpg`;

                // 1. Base64 string'i geçici dosyaya yaz
                $os.writeFile(tmpBase64Path, base64String);

                // 2. Linux 'base64' komutu ile decode et (Çok hızlı ve güvenli)
                // base64 -d input.b64 > output.jpg
                const cmd = $os.cmd("sh", "-c", `base64 -d ${tmpBase64Path} > ${tmpImagePath}`);

                // cmd.run() hata fırlatabilir veya output dönebilir, basitçe çalıştıralım
                try {
                    cmd.run();
                } catch (cmdErr) {
                    console.log("CMD Warning:", cmdErr);
                }

                // 3. PocketBase'e dosyayı yükle
                // fileFromPath: Diskten dosyayı okur ve Multipart File nesnesi yapar
                const file = $filesystem.fileFromPath(tmpImagePath);

                book.set("generated_image", file);

                book.set("image_gen_status", "completed");
                book.set("image_prompt", masterPrompt);

                $app.save(book);
                console.log(`--> [ImageJob] BASARILI (Storage): ${bookTitle}`);
                console.log(`--> [ImageJob] Fiziksel Konum: ${$app.dataDir()}/storage/${book.collection().id}/${book.id}`);

                // 4. Temizlik (Cleanup)
                try {
                    $os.remove(tmpBase64Path);
                    $os.remove(tmpImagePath);
                } catch (e) { /* ignore cleanup errors */ }

            } catch (err) {
                console.log(`[ImageJob] Hata (${bookTitle}): ${err}`);
                // Hata durumunda kaydı güncelle
                try {
                    // Record'u tazeleyip hata mesajı yazalım
                    const failBook = $app.findRecordById("books", book.id);
                    failBook.set("image_gen_status", "failed");
                    failBook.set("ai_notes", "Img Error: " + err.toString().substring(0, 150));
                    $app.save(failBook);
                } catch (e) { }
            }
        });

    } catch (e) {
        console.log("[ImageJob] Fatal Error:", e);
    }
});