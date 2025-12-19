# PocketBase JS Hooks - Best Practices & Troubleshooting Guide (Updated: 2025-12-19)

This guide documents the specific behaviors, pitfalls, and solutions discovered while implementing backend logic (specifically AI recommendations and Credit System) in the BookVault project.

## 1. Authentication in Router Hooks (`routerAdd`)

Authentication in custom router hooks behaves differently than in standard event hooks (`onRecord...`).

### Problem: Using `e.auth` or `c.get("authRecord")`
*   **Issue:** `c.get("authRecord")` often returns `null` or `undefined` in `routerAdd` contexts, even if the request has a valid Bearer token.
*   **Issue:** `c.auth` might not be strictly typed or available as expected depending on the PB version wrapper.

### **Solution: Use `c.requestInfo().auth`**
The reliable way to check for the authenticated user in a custom route is via the request info object.

```javascript
routerAdd("POST", "/api/my-custom-route", (c) => {
    const info = c.requestInfo();
    const authData = info.auth; // Contains the user info struct (plain object)

    if (!authData) {
        return c.json(401, { error: "Authentication required" });
    }

    // authData is a PLAIN OBJECT (struct), not a full Record model.
    // It has properties like authData.id, authData.email, etc.
});
```

## 2. Database Operations (`$app`)

The global `$app` object exposes database methods, but the API may differ from the standard Go documentation depending on the JSVM binding version.

### Problem: `Object has no member 'dao'`
*   **Error:** `TypeError: Object has no member 'dao'` when calling `$app.dao().findRecordById(...)`.
*   **Cause:** In this environment, the `dao()` helper is either not exposed or the methods are mapped directly to `$app`.

### **Solution: Use Direct Methods on `$app`**

| Standard Doc (Go/JS) | Working Implementation (BookVault Environment) |
| :--- | :--- |
| `$app.dao().findRecordById("users", id)` | **`$app.findRecordById("users", id)`** |
| `$app.dao().saveRecord(record)` | **`$app.save(record)`** |
| `$app.dao().findRecordsByFilter(...)` | **`$app.findRecordsByFilter(...)`** |

## 3. JSON Fields in JS Hooks (CRITICAL)

When retrieving data from a JSON type column in a PocketBase JS Hook, you must handle the data type carefully.

### Problem: `record.get("field")` returns Byte Array
*   **Issue:** Accessing a JSON field via `record.get("some_json_field")` returns a Go byte slice, which appears in JS as a `Uint8Array` (e.g., `[123, 34, 101, ...]`).
*   **Consequence:** Directly accessing properties (e.g., `data.price`) fails because `data` is an array of numbers, not an object. `JSON.parse` also fails on an array.

### **Solution: Use `record.getString("field")`**
The `getString` method automatically handles the byte-to-string conversion for you.

```javascript
// AVOID THIS:
let jsonData = record.get("meta_data"); // Returns [123, 34, ...] (Byte Array)

// DO THIS:
let jsonString = record.getString("meta_data"); // Returns '{"key": "value"}'
let data = JSON.parse(jsonString);
console.log(data.key); // Works!
```

## 4. React Native Realtime (SSE)

PocketBase uses Server-Sent Events (SSE) for its Realtime capabilities. React Native does not support SSE natively.

### Problem: Realtime subscriptions fail silently
*   **Issue:** `pb.collection('...').subscribe(...)` fails with error `[ClientResponseError 0: Something went wrong.]` or simply never receives events.
*   **Cause:** Missing `EventSource` API in React Native environment.

### **Solution: Polyfill `EventSource`**
1.  Install `react-native-sse`.
2.  Polyfill it globally **before** initializing PocketBase.

**File: `src/services/pocketbase.ts`**
```typescript
import EventSource from "react-native-sse";
// @ts-ignore
global.EventSource = EventSource;

export const pb = new PocketBase(...);
```
*(Also requires `pod install` on iOS after adding the package)*

## 5. Realtime Strategies (Best Practices)

### Dynamic Configuration (Singleton Pattern)
For App-wide settings (Pricing, Promo Text, Maintenance Mode):
1.  Create a single specific collection `system_settings`.
2.  Use a `ConfigContext` to fetch validation on load AND subscribe to `*` (all) events.
3.  Benefit: No App Store update needed to change prices or texts.

### User Data Sync
To keep user credits and profile data in sync across devices (or when modified by background Cron Jobs):
1.  In `AuthProvider` (or `AuthContext`), setup a `useEffect` that depends on `user.id`.
2.  Subscribe to `pb.collection('users').subscribe(user.id, ...)`
3.  On update, merge the new record into the local state.

## 6. Modular Code & `require`

To keep hooks clean, move shared logic (like credit checks) to utility files.

*   **Location:** Store shared files in `pb_hooks/utils.js`.
*   **Loading:** Use `require` with the `__hooks` global constant.
*   **Compatibility:** Ensure the module handles the JSVM environment correctly (e.g., checking `typeof module`).

**File: `pb_hooks/utils.js`**
```javascript
module.exports = {
    checkCredits: (userRecord, amount) => { ... }
};
```

**File: `pb_hooks/main.js`**
```javascript
const utils = require(`${__hooks}/utils.js`);
utils.checkCredits(user, 1);
```

## 7. Deployment Workflow
Changes to hooks are not hot-reloaded instantly in all environments.
*   **Command:** Use the helper script `./scripts/deploy_hook.sh <file>` to push changes to the server.
*   **Restart:** Often requires `./pocketbase serve` restart to pick up changes in `routerAdd` definitions reliably.
