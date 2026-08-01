# BookVault

Dual-mode mobile library management app built with React Native and TypeScript. Combines book library management (BookVault mode) with movie/adaptation tracking (CineVault mode). Features AI-powered book enrichment, recommendation engine, and real-time sync with a PocketBase backend.

## Tech Stack

- **Framework:** React Native 0.76.5 (CLI, not Expo)
- **Language:** TypeScript 5.0.4
- **Styling:** NativeWind v4 (Tailwind CSS for React Native)
- **State:** React Context API + TanStack React Query v5
- **Navigation:** React Navigation v7 (stack + bottom tabs)
- **Backend:** PocketBase (self-hosted, SQLite, JS hooks)
- **Real-time:** `react-native-sse` (EventSource polyfill for PocketBase subscriptions)
- **Monetization:** RevenueCat v9.6.11
- **Localization:** i18next (English & Turkish)

## Commands

```bash
# Install dependencies
npm install

# iOS setup (run once, or after adding new native modules)
cd ios && bundle install && bundle exec pod install && cd ..

# Start Metro bundler
npm start
npx react-native start --reset-cache  # if changes aren't picked up

# Run app
npm run ios
npm run android

# Quality
npm run lint
npm test
```

## Project Structure

```
src/
├── components/       # Reusable components (AIStatusBadge, CharacterCard)
├── config/           # i18n setup
├── context/          # AuthContext, ModeContext, ConfigContext
├── hooks/            # useGoogleBooks, useTMDB, useSpotify, useDebounce
├── locales/          # en.json, tr.json
├── navigation/       # AuthNavigator, MainNavigator, MovieNavigator, tab navigators
├── screens/          # Screen components (auth/, movies/, book screens)
└── services/         # pocketbase.ts, tmdb.ts, revenuecat.ts

backend/
└── pb_hooks/         # PocketBase server-side JS hooks (13 files)

docs/
├── AI_DEVELOPER_GUIDE.md
└── pocketbase_cheatsheet.md
```

## Architecture

### Dual-Mode App
`ModeContext` toggles between BookVault (books) and CineVault (movies). Each mode has its own navigator and bottom tab structure.

### Data Flow
```
User Action → TanStack Query → PocketBase API
                                    ↓
                             Backend JS Hooks (AI, processing)
                                    ↓
                             Database Update
                                    ↓
                             Real-time EventSource → UI Update
```

### Context Providers
- **AuthContext** — user session, login/logout, credits, realtime user data
- **ModeContext** — book/movie mode toggle, persisted to AsyncStorage
- **ConfigContext** — dynamic system settings (AI pricing, promo text) via realtime PocketBase subscription

### TanStack Query defaults
- `staleTime: 5 * 60 * 1000` (5 minutes)
- `retry: 2`

## Backend (PocketBase Hooks)

All heavy processing runs in `backend/pb_hooks/`. Key hooks:

| Hook file | Purpose |
|-----------|---------|
| `pocketjs.book-enrichment.js` | AI book analysis (summary, tags, vibes) |
| `pocketjs.recommendation.js` | Personalized book recommendations |
| `pocketjs.quote-gen.js` | AI quote generation |
| `pocketjs.movie-search.js` | TMDB movie metadata |
| `pocketjs.payment-webhook.js` | RevenueCat webhook handling |
| `pocketjs.credits.js` | Credit system |

### AI fallback chain (book enrichment)
All text-generation hooks call OpenRouter's chat completions API (`https://openrouter.ai/api/v1/chat/completions`) with `OPENROUTER_API_KEY`, trying models in order until one succeeds:
1. `openai/gpt-4o-mini` (primary)
2. `google/gemini-2.0-flash-001` (secondary)
3. `anthropic/claude-3-5-haiku` (backup)

### Critical PocketBase JSON gotcha
PocketBase JSVM returns JSON fields as Uint8Arrays. Always use:
```javascript
// Wrong
record.get("config")         // → Uint8Array [123, 34, ...]
// Right
JSON.parse(record.getString("config"))  // → Object
```

## Key Implementation Notes

- `react-native-reanimated` is **not included** — incompatible with RN 0.76.5
- Real-time requires the `react-native-sse` EventSource polyfill injected into the PocketBase client
- NativeWind: complex nested absolute positioning can behave differently between iOS and Android
- PocketBase URL is hardcoded in `src/services/pocketbase.ts`
- RevenueCat keys are in `src/services/revenuecat.ts` (debug/release aware)
- Search inputs are debounced at 500ms via `useDebounce`
