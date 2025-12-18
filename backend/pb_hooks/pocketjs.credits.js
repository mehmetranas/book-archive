/// <reference path="../pb_data/types.d.ts" />

// 1. Yeni Kayıt Olan Kullanıcıya Hoşgeldin Kredisi
onRecordAfterCreateSuccess((e) => {
    const record = e.record;

    // Yeni kullanıciya 10 kredi hediye et (eğer yoksa)
    const current = record.getInt("credits");
    if (current === 0) {
        // Doğrudan set ve saveRecord kullanmak yerine e.record üzerinde çalışıyoruz.
        // Ancak AfterCreateSuccess olduğu için DB'ye tekrar yazmalıyız.
        // Güvenli yöntem olarak yeni $app metodunu kullanıyoruz.
        record.set("credits", 10);
        $app.save(record);
    }

    e.next();
}, "users");


// 2. GÜVENLİK: Kullanıcının Kendi Kredisini Değiştirmesini Engelle
// Kullanıcı profilini güncellerken (örneğin ismini), araya sızıp "credits: 1000" gönderirse bunu engellemeliyiz.
onRecordBeforeUpdateRequest((e) => {
    const record = e.record;       // Veritabanındaki mevcut kayıt
    const oldCredits = record.getInt("credits");

    // İstekten gelen veriyi kontrol etmek için requestInfo'yu kullanabiliriz veya
    // PocketBase hook'larında record.load(data) otomatik yapılmış olabilir.
    // Ancak e.record MEVCUT hali değil, GÜNCELLENMİŞ halidir (memory'de).
    // O yüzden original kopyasını alıp karşılaştırmak daha güvenilirdir ama
    // 'onRecordBeforeUpdate' hook'unda e.record zaten form verisiyle doldurulmuştur.

    // Gelen isteği yapan kişinin yetkisini kontrol edelim
    const info = e.requestInfo(); // İstek bilgisini al
    const authRecord = info.auth; // Kim giriş yapmış?

    // Eğer admin değilse (normal kullanıcı ise) kredisini değiştiremez!
    if (authRecord && !authRecord.isSuperuser()) {
        // Veritabanındaki orijinal kaydı çekelim
        const originalRecord = $app.findRecordById("users", record.id);
        const originalCredits = originalRecord.getInt("credits");
        const newCredits = record.getInt("credits");

        if (originalCredits !== newCredits) {
            // HATA FIRLAT: Kullanıcı kredisini elle değiştirmeye çalışıyor!
            throw new BadRequestError("Kredi bakiyenizi manuel olarak değiştiremezsiniz.");
        }
    }

    e.next();
}, "users");
