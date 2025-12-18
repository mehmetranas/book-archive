# PocketBase JS Hooks - Best Practices & Troubleshooting Guide (Updated: 2025-12-18)

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

### Example: Transaction-Safe Credit Deduction
To modify a user's record (e.g., deduct credits), **always fetch a fresh record** using the ID from the auth struct. Do not try to cast the auth struct to a Record.

```javascript
const userId = authData.id || authData.getId(); // Handle both struct and model cases

// 1. Fetch fresh record (Direct method)
const userRecord = $app.findRecordById("users", userId);

// 2. Modify
const currentCredits = userRecord.getInt("credits");
userRecord.set("credits", currentCredits - 1);

// 3. Save (Direct method)
$app.save(userRecord);
```

## 3. Modular Code & `require`

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

## 4. Error Handling Patterns

*   **400 Bad Request:** For missing params or invalid body.
*   **401 Unauthorized:** If `requestInfo().auth` is missing.
*   **402 Payment Required:** Specific code for "Insufficient Credits". Frontend listens for this to show "Buy Credits" UI.
*   **500 Internal Server Error:** Catch-all for DB or AI provider failures.

## 5. Deployment Workflow
Changes to hooks are not hot-reloaded instantly in all environments.
*   **Command:** Use the helper script `./scripts/deploy_hook.sh <file>` to push changes to the server.
*   **Restart:** Often requires `./pocketbase serve` restart to pick up changes in `routerAdd` definitions reliably.
