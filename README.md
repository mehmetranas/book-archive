# BookVault

React Native CLI (0.76.5) ile TypeScript kullanılarak oluşturulmuş bir kitap yönetim uygulaması.

## 📦 Kurulu Paketler

### Styling
- **nativewind** (v4) - Tailwind CSS for React Native
- **tailwindcss** - Utility-first CSS framework

### Navigation
- **@react-navigation/native** (v6) - Navigation framework
- **@react-navigation/bottom-tabs** - Bottom tab navigator
- **react-native-screens** - Native navigation primitives
- **react-native-safe-area-context** - Safe area handling

### Localization (i18n)
- **i18next** - Internationalization framework
- **react-i18next** - React bindings for i18next
- **react-native-localize** - Device locale detection

### Networking
- **axios** - HTTP client
- **@tanstack/react-query** (TanStack Query) - Data fetching and caching

### Backend & Authentication
- **pocketbase** - Backend as a Service (BaaS)
- **@react-native-async-storage/async-storage** - Persistent storage for auth tokens

### Icons
- **react-native-vector-icons** - Icon library (Ionicons, MaterialIcons, FontAwesome)

## 🚀 Başlangıç

### iOS

1. CocoaPods bağımlılıklarını yükleyin:
```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

2. Uygulamayı çalıştırın:
```bash
npx react-native run-ios
```

### Android

```bash
npx react-native run-android
```

## 📁 Proje Yapısı

```
BookVault/
├── src/
│   ├── config/
│   │   └── i18n.ts          # i18n yapılandırması (otomatik dil algılama)
│   ├── context/
│   │   └── AuthContext.tsx  # Auth context provider
│   ├── locales/
│   │   ├── en.json          # İngilizce çeviriler
│   │   └── tr.json          # Türkçe çeviriler
│   ├── navigation/
│   │   ├── AuthNavigator.tsx        # Auth navigation (Login/Register)
│   │   └── BottomTabNavigator.tsx   # Tab navigation yapısı
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx      # Giriş ekranı
│   │   │   └── RegisterScreen.tsx   # Kayıt ekranı
│   │   ├── LibraryScreen.tsx        # Kütüphane ekranı
│   │   ├── SearchScreen.tsx         # Arama ekranı
│   │   └── SettingsScreen.tsx       # Ayarlar ekranı
│   └── services/
│       └── pocketbase.ts    # PocketBase service (AsyncAuthStore)
├── App.tsx                  # Ana uygulama bileşeni
├── global.css              # NativeWind global styles
└── tailwind.config.js      # Tailwind yapılandırması
```

## 🌐 Dil Desteği

Uygulama açılışında otomatik olarak telefonun dilini algılar ve desteklenen diller arasında (TR/EN) uygun olanı seçer.

Desteklenen diller:
- 🇹🇷 Türkçe
- 🇬🇧 English

## 🔐 Authentication (PocketBase)

PocketBase backend entegrasyonu ile kullanıcı kimlik doğrulaması:

- **AsyncAuthStore**: Token'lar AsyncStorage'da saklanır
- **Auto-login**: Uygulama açılışında otomatik giriş
- **Login/Register**: Kullanıcı dostu giriş ve kayıt ekranları
- **Validation**: Email ve şifre doğrulama
- **Error Handling**: i18n destekli hata mesajları

Backend URL: `https://book.api.cinevault.space`

## 🎨 Styling

NativeWind v4 kullanılarak Tailwind CSS class'ları ile styling yapılmıştır:

```tsx
<View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
  <Text className="text-2xl font-bold text-gray-900 dark:text-white">
    Merhaba Dünya
  </Text>
</View>
```

## 🧭 Navigation

Bottom Tabs yapısı:
- **Library** - Kitap kütüphanesi
- **Search** - Kitap arama
- **Settings** - Uygulama ayarları

Auth Navigation:
- **Login** - Kullanıcı girişi
- **Register** - Yeni kullanıcı kaydı

## 📱 Özellikler

- ✅ TypeScript desteği
- ✅ NativeWind (Tailwind CSS) styling
- ✅ Bottom tab navigation
- ✅ PocketBase authentication
- ✅ Persistent auth with AsyncStorage
- ✅ Login/Register screens
- ✅ Çoklu dil desteği (i18n)
- ✅ Otomatik dil algılama
- ✅ TanStack Query (React Query) entegrasyonu
- ✅ Axios HTTP client
- ✅ Vector icons (iOS & Android)
- ✅ Dark mode desteği

## 🔧 Yapılandırma Dosyaları

- `babel.config.js` - NativeWind plugin
- `metro.config.js` - NativeWind CSS transformer
- `tailwind.config.js` - Tailwind CSS yapılandırması
- `tsconfig.json` - TypeScript yapılandırması
- `ios/BookVault/Info.plist` - iOS font yapılandırması
- `android/app/build.gradle` - Android font yapılandırması

## 📝 Notlar

- NativeWind v4 kullanılmaktadır
- iOS için vector icons Info.plist'e eklenmiştir
- Android için vector icons build.gradle'a eklenmiştir
- i18n otomatik dil algılama ile yapılandırılmıştır
- TanStack Query 5 dakika stale time ile yapılandırılmıştır
- **Not:** react-native-reanimated React Native 0.76.5 ile uyumsuzluk nedeniyle dahil edilmemiştir

## 🛠️ Geliştirme

Metro bundler'ı başlatmak için:
```bash
npx react-native start
```

Cache'i temizlemek için:
```bash
npx react-native start --reset-cache
```
