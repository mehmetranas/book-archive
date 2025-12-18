/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
    const record = e.record;

    // Yeni kullanıciya 10 kredi hediye et (eğer yoksa)
    if (record.getInt("credits") === 0 || record.getInt("credits") === null) {
        record.set("credits", 10);
        $app.dao().saveRecord(record);
    }

    e.next();
}, "users");
