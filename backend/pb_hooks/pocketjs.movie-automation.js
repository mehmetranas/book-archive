/// <reference path="../pb_data/types.d.ts" />

// -----------------------------------------------------------------------------
// MOVIE AUTOMATION HOOK
// -----------------------------------------------------------------------------
// Bir film kütüphaneye eklendiğinde (movies tablosuna kayıt),
// otomatik olarak Global Movie kaydını kontrol et/oluştur
// ve Vibe analizini (vibe_status='pending') başlat.
// -----------------------------------------------------------------------------

onRecordAfterCreateSuccess((e) => {
    const movieRecord = e.record;
    const tmdbId = movieRecord.getInt("tmdb_id");
    const title = movieRecord.getString("title");

    console.log(`[Movie Auto] New movie added: ${title} (${tmdbId})`);

    if (!tmdbId) {
        console.log(`[Movie Auto] No TMDB ID, skipping automation.`);
        return e.next();
    }

    try {
        // 1. Global Kaydı Ara
        // 'global_movies' tablosunda bu tmdb_id var mı?
        const existingGlobal = $app.findRecordsByFilter(
            "global_movies",
            `tmdb_id = '${tmdbId}'`,
            "-created",
            1
        );

        let globalRecord;

        if (existingGlobal.length > 0) {
            // Var Olan Kayıt
            globalRecord = existingGlobal[0];
            const currentStatus = globalRecord.getString("vibe_status");

            // Eğer analiz hiç yapılmamışsa veya başarısızsa tekrar kuyruğa al ('pending')
            // Eğer 'completed' veya 'processing' ise dokunma.
            if (!currentStatus || currentStatus === "none" || currentStatus === "failed") {
                globalRecord.set("vibe_status", "pending");
                $app.save(globalRecord);
                console.log(`[Movie Auto] Existing global record queueing for analysis.`);
            } else {
                console.log(`[Movie Auto] Global record already has status: ${currentStatus}`);
            }

        } else {
            // Yeni Kayıt Oluştur
            console.log(`[Movie Auto] Creating new global_movies record...`);
            const collection = $app.findCollectionByNameOrId("global_movies");

            globalRecord = new Record(collection);
            globalRecord.set("tmdb_id", tmdbId);
            globalRecord.set("title", title);
            globalRecord.set("vibe_status", "pending"); // Otomatik başlat

            $app.save(globalRecord);
            console.log(`[Movie Auto] Created new global record: ${globalRecord.id}`);
        }

        // 2. Local Kaydı Global'e Bağla
        // Eklenen 'movies' kaydının 'global_values' alanını güncelle
        if (movieRecord.getString("global_values") !== globalRecord.id) {
            // Not: e.record salt okunur olabilir veya döngüye girmemesi için
            // yeni bir instance çekip güncellemek daha güvenlidir.
            const freshMovie = $app.findRecordById("movies", movieRecord.id);
            freshMovie.set("global_values", globalRecord.id);
            $app.save(freshMovie);
            console.log(`[Movie Auto] Linked local movie to global record.`);
        }

    } catch (err) {
        console.log(`[Movie Auto] Error in automation: ${err.message}`);
    }

    e.next();
}, "movies");
