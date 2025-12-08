// test-script.js
// BU DOSYA SADECE YEREL TEST İÇİNDİR.

// 1. API Key'ini buraya manuel yaz (Test bitince sil!)
const apiKey = "..."; // <-- BURAYA GERÇEK KEY'İNİ YAZ

// 2. Mock Kitap Verisi (PocketBase'den geliyormuş gibi)
const mockBook = {
    id: "test_book_123",
    title: "Suç ve Ceza",
    authors: ["Fyodor Dostoyevski"], // String veya Array olabilir, kod bunu handle ediyor
    language_code: "tr"
};

console.log(`[TEST] Isleniyor: ${mockBook.title}`);

// --- WORKER MANTIĞI (Kopyala-Yapıştır Kısmı) ---

async function runTest() {
    try {
        // Yazar Parsing Mantığı (Aynen koruyoruz)
        let inputAuthorStr = "";
        const rawAuthors = mockBook.authors;
        if (Array.isArray(rawAuthors)) {
            inputAuthorStr = rawAuthors.join(", ");
        } else {
            inputAuthorStr = String(rawAuthors || "");
        }

        // Prompt (Aynen koruyoruz)
        const masterPrompt = `
Roleplay as an expert "Bookstagram" photographer and literary curator. I will provide you with a book title. Your task is to create a stunning, atmospheric Instagram post image (square aspect ratio 1:1) based on that book.

Follow these steps precisely:

1. QUOTE SELECTION: Select the most iconic, recognizable, and profound quote from the given book. If it is not turkish translate it to turkish language
2. MOOD ANALYSIS: Analyze the emotional weight, setting, and central theme of that specific quote and the book itself.
3. VISUAL TRANSLATION: Translate that specific mood into visual elements (Setting, Lighting, Props).
4. COMPOSITION & TEXT: The image must feature an open book or a textured paper surface where the selected quote is clearly printed elegantly. The typography should match the book's genre. The overall style should be a high-quality, photographic "flat lay" or cozy scene.
Format the text using a classic serif typeface (specifically EB Garamond or Libre Baskerville) to convey a literary tone. Render the main quote in italics for emphasis, and strictly position the book title in the bottom-right corner using a smaller, non-italicized font size.

CREATE THE IMAGE FOR THE BOOK: ${mockBook.title}
`;

        console.log("[TEST] Prompt Hazirlandi. API Istegi atiliyor...");

        // API Çağrısı (Node.js 'fetch' kullanarak)
        // Gemini 3 Pro Image Preview modelini kullanıyoruz
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: masterPrompt }] }],
                generationConfig: {
                    responseModalities: ["IMAGE"]
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Hatasi (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // Gemini Response Parsing (Candidates -> Content -> Parts -> InlineData)
        let base64Image = null;
        if (data.candidates && data.candidates.length > 0) {
            const parts = data.candidates[0].content.parts;
            for (const part of parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith("image")) {
                    base64Image = part.inlineData.data;
                    break;
                }
            }
        }

        if (!base64Image) {
            // Fallback: Belki eski formatta veya farklı bir yapıda dönmüştür
            console.log("Full Response:", JSON.stringify(data, null, 2));
            throw new Error("Gorsel uretilemedi (Gecersiz Yanit Yapisi)");
        }

        console.log("---------------------------------------------------");
        console.log("[TEST] BAŞARILI! Resim üretildi.");
        console.log(`[TEST] Base64 Uzunluğu: ${base64Image.length} karakter.`);
        console.log("---------------------------------------------------");

        // İstersen base64'ü dosyaya yazıp görebilirsin (Node.js fs modülü ile)
        const fs = require('fs');
        const buffer = Buffer.from(base64Image, 'base64');
        fs.writeFileSync('test_output.png', buffer);
        console.log("[TEST] Resim 'test_output.png' olarak kaydedildi. Kontrol et!");

    } catch (err) {
        console.error("[TEST] HATA:", err);
    }
}

// Testi Başlat
runTest();
