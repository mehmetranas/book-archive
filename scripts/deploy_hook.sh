#!/bin/bash

# --- AYARLAR ---
# --- AYARLAR ---
# Sunucu adresi (IP ve Kullanıcı)
SERVER="root@95.217.152.157"

# SSH Key Dosyası
SSH_KEY="$HOME/.ssh/hetzner_key"

# Sunucudaki pb_hooks klasörünün tam yolu
REMOTE_PATH="/var/lib/docker/volumes/og0gcww0s8ossck88gcoow44_pocketbase-hooks/_data" 

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
EXTENSION="${FILENAME##*.}"
FILENAME_NO_EXT="${FILENAME%.*}"

# PocketBase hook'ları genelde .pb.js ile biter.
if [[ "$FILENAME" == *".pb.js" ]]; then
    REMOTE_FILENAME="$FILENAME"
else
    REMOTE_FILENAME="${FILENAME_NO_EXT}.pb.js"
fi

echo "----------------------------------------"
echo "📂 Local Dosya: $LOCAL_FILE"
echo "🚀 Hedef: $SERVER:$REMOTE_PATH/$REMOTE_FILENAME"
echo "----------------------------------------"

# Dosyayı sunucuya kopyala (-i ile key dosyasını belirtiyoruz)
scp -i "$SSH_KEY" "$LOCAL_FILE" "$SERVER:$REMOTE_PATH/$REMOTE_FILENAME"

if [ $? -eq 0 ]; then
  echo "✅ Yükleme Başarılı!"
  
  # İsteğe bağlı: Değişikliğin hemen algılanması için gerekirse restart atılabilir
  # ama PB hook değişikliklerini (dosya yeni ise) bazen otomatik, bazen restart ile görür.
  # ssh "$SERVER" "systemctl restart pocketbase"
else
  echo "❌ Yükleme Başarısız oldu."
fi
