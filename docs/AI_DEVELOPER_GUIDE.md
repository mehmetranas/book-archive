# BookVault & CineVault - AI Developer Guide & Project Context

> **Last Updated:** 2025-12-19
> **Purpose:** This document serves as the primary source of truth for AI assistants and developers working on this project. It details architecture, business logic, pitfalls, and future suggestions.

---

## 1. Project Overview

**BookVault** is a sophisticated personal library management application built with **React Native** (Client) and **PocketBase** (Backend). It is not just a CRUD app; it features a heavy "AI Enrichment" layer that automatically analyzes books, suggests movie adaptations, generates quotes, and creates visual content.

### Core Modes
The app runs in two modes (toggled via `ModeContext`):
1.  **BookVault:** Focuses on books, reading tracking, and AI analysis.
2.  **CineVault:** Focuses on movies, specialized for users who want to track adaptations of books (Movie Collection).

---

## 2. Tech Stack

### Client (Mobile)
*   **Framework:** React Native (CLI workflow, not Expo Go).
*   **Language:** TypeScript.
*   **Styling:** NativeWind (TailwindCSS for React Native).
*   **State Management:** React Context API (`AuthContext`, `ConfigContext`, `ModeContext`) + React Query (TanStack Query) for server state.
*   **Navigation:** React Navigation (Stack + Drawer).
*   **Realtime:** `react-native-sse` (Polyfill for EventSource to enable PocketBase realtime).

### Backend (Server)
*   **Core:** PocketBase (Golang based, portable backend).
*   **Scripting:** PocketBase JS Hooks (running on Goja VM).
*   **Database:** SQLite (Embedded in PocketBase).
*   **External APIs Used in Hooks:**
    *   **OpenAI / Gemini:** For book summarization, vibe checks, quote generation.
    *   **TMDB API:** For fetching movie metadata.
    *   **Google Books API:** For initial book search on the client side.

---

## 3. Architecture & Data Flow

### The "Hybrid" Logic Pattern
The app uses a hybrid approach where immediate actions happen on the Client, but heavy logic happens on the Backend via Hooks/Cron.

1.  **User Action:** User searches for a book (Google Books API) and clicks "Add".
2.  **Client:** Saves a bare-bones record to the `books` collection in PocketBase.
3.  **Backend (Reactive):**
    *   `onRecordCreate` or Cron Jobs detect the new book.
    *   Status is set to `pending`.
    *   **Enrichment Hook** runs: Fetches detailed summary, tags, and "Vibe" from AI.
    *   If a movie adaptation exists, it fetches data from TMDB and creates a `movies` record.
    *   Status updates to `completed`.
4.  **Client (Realtime):** The UI subscribes to the record. When the backend finishes enrichment, the UI automatically updates (e.g., loading spinner -> content).

### Key Contexts
*   **`AuthContext`:** Manages user session AND realtime synchronization of user data (credits).
*   **`ConfigContext`:** Fetches dynamic `system_settings` (e.g., AI pricing, promo texts) and keeps them in sync via Realtime. **Crucial for avoiding App Store updates for config changes.**

---

## 4. Critical Business Logic (Backend Hooks)

All backend logic resides in `/backend/pb_hooks/`.

### A. Book Enrichment (`pocketjs.book-enrichment.js`)
*   **Trigger:** Cron Job (every minute) or Event Hook.
*   **Process:**
    1.  Finds books with `enrichment_status = 'pending'`.
    2.  Checks User Credits (Deducts dynamically based on `system_settings`).
    3.  Calls AI to generate Summary, Tags, and structured metadata.
    4.  Updates Book record.

### B. Credit System
*   **Logic:** Credits are stored on the `users` collection.
*   **Deduction:** Occurs strictly on the server side (Hook) to prevent tampering.
*   **Dynamic Pricing:** The cost of operations is NOT hardcoded. It is read from the `system_settings` collection (`ai_pricing` JSON field).

### C. Recommendation Engine (`pocketjs.recommendation.js`)
*   **Trigger:** Custom Endpoint or Cron.
*   **Logic:** Analyzes user's library vectors/tags to suggest new books.

---

## 5. Technical Pitfalls & "Gotchas"

### 1. JSON Handling in PocketBase Hooks (Crucial)
PocketBase JSVM returns JSON fields as **Byte Arrays (Uint8Array)**, not Strings or Objects.
**Wrong:** `record.get("config")` -> returns `[123, 34, ...]`
**Right:** `JSON.parse(record.getString("config"))` -> returns Object.

### 2. React Native Realtime
React Native does NOT support `EventSource` natively.
**Solution:** We use `react-native-sse` polyfill injected in `src/services/pocketbase.ts`. Without this, `pb.collection().subscribe()` fails silently.

### 3. NativeWind & Styling
We use `className` props. If a style doesn't apply, check `tailwind.config.js`. Some complex layouts (nested absolute positioning) behave differently on iOS vs Android.

---

## 6. Database Schema (Key Collections)

*   **`users`**: `id`, `email`, `credits` (int), `avatar`.
*   **`books`**: `id`, `title`, `user` (relation), `enrichment_status` (enum: none, pending, processing, completed), `ai_notes` (text), `tags` (json).
*   **`movies`**: `id`, `tmpl_id`, `book` (relation), `media_type`.
*   **`system_settings`**: A singleton collection (publicly readable).
    *   `ai_pricing` (JSON): `{ "enrichment_cost": 1, "image_gen_cost": 1 }`
    *   `promo_text` (String).

---

## 7. Future Roadmap & AI Suggestions

This section lists features or improvements that should be considered by the next AI assistant.

### ⚠️ Technical Debt / Improvements
1.  **Shared Types:** Currently, TypeScript types for PocketBase records are manually defined in the frontend. We should generate them automatically from the PocketBase schema (using `pocketbase-typegen`) to ensure backend-frontend type safety.
2.  **Offline Support:** The app currently relies heavily on connection. Implementing WatermelonDB or persisting React Query cache would improve UX.
3.  **Error Monitoring:** No Sentry or Crashlytics installed. Debugging production issues is difficult.

### 🚀 Feature Ideas
1.  **Social Features:** "Shared Libraries" or "Book Lending" between users.
2.  **OCR Scanner:** Add "Scan Book Cover" feature using Camera to quickly add books (via Google Vision API or MLKit) instead of typing.
3.  **Reading Analytics:** specific logic to track "Pages Read per Day" and generate graphs.
4.  **Voice Interaction:** "Hey BookVault, summarize my last book."

---

## 8. How to modify Backend Logic
1.  Edit files in `backend/pb_hooks/`.
2.  Run `./scripts/deploy_hook.sh <filename>` to push to the VPS.
3.  (Ideally) Test locally first using a local PocketBase instance, but currently, we often dev against the live dev-server (caution advised).
