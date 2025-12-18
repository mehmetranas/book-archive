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

// NOT: Güvenlik kontrolleri (Manuel kredi değişimini engelleme) artık PocketBase API Kuralları (API Rules) 
// üzerinden yönetileceği için koddan kaldırılmıştır.
// Admin Panel > Collections > users > API Rules > Update kısmına:
// id = @request.auth.id && @request.data.credits:isset = false
