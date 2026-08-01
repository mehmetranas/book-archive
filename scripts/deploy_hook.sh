#!/bin/bash

# --- AYARLAR ---
# --- AYARLAR ---
# Sunucu adresi (~/.ssh/config icindeki "contabo-deploy" host'unu kullanir - passphrase'siz deploy key)
SERVER="contabo-deploy"

# SSH Key Dosyası (contabo host'u icin ~/.ssh/config'te tanimli, burada gerek yok)
SSH_KEY=""

# Sunucudaki pb_hooks klasörünün tam yolu (Coolify - book-archive-pocketbase servisi)
REMOTE_PATH="/var/lib/docker/volumes/kq8aie8spc022bbpv507kdmq_pocketbase-hooks/_data"

# ---------------

if [ -z "$1" ]; then
  echo "Kullanım: ./scripts/deploy_hook.sh <dosya_adi>"
  echo "Ornek: ./scripts/deploy_hook.sh pocketjs.book-search.js"
  exit 1
fi

ARG_FILE="$1"

# 1. Dosya direkt var mi?
if [ -f "$ARG_FILE" ]; then
    LOCAL_FILE="$ARG_FILE"
# 2. backend/pb_hooks altinda mi?
elif [ -f "backend/pb_hooks/$ARG_FILE" ]; then
    LOCAL_FILE="backend/pb_hooks/$ARG_FILE"
else
    echo "❌ Hata: Dosya bulunamadi: $ARG_FILE"
    echo "Aranan yerler: ./$ARG_FILE ve ./backend/pb_hooks/$ARG_FILE"
    exit 1
fi

FILENAME=$(basename "$LOCAL_FILE")

# Sunucudaki dosyalar orijinal adiyla (pocketjs.*.js) duruyor, .pb.js'e cevirmiyoruz
# (cevirirsek ayni hook iki kez -eski ve yeni isimle- yuklenir).
REMOTE_FILENAME="$FILENAME"

echo "----------------------------------------"
echo "📂 Local Dosya: $LOCAL_FILE"
echo "🚀 Hedef: $SERVER:$REMOTE_PATH/$REMOTE_FILENAME"
echo "----------------------------------------"

# Dosyayı sunucuya kopyala (key ~/.ssh/config'teki "contabo" host tanımından geliyor)
scp "$LOCAL_FILE" "$SERVER:$REMOTE_PATH/$REMOTE_FILENAME"

if [ $? -eq 0 ]; then
  echo "✅ Yükleme Başarılı!"
  
  # PocketBase pb_hooks degisikliklerini hooksWatch ile otomatik algilayip restart eder.
  # Otomatik algilanmazsa manuel restart:
  # ssh "$SERVER" "docker restart pocketbase-kq8aie8spc022bbpv507kdmq"
else
  echo "❌ Yükleme Başarısız oldu."
fi
