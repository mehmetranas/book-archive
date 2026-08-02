/**
 * One-off: adds summary/tags/sentiment fields to the `notes` collection via
 * the PocketBase admin API (Phase 1 books migration - book-enrichment worker
 * needs somewhere to write AI-generated note metadata).
 *
 * After running, sync the printed field definitions into
 * backend/pb_migrations/1785181824_collections_snapshot.js so the snapshot
 * matches production (same pattern as commit 749e8f4).
 *
 * Usage: npm run add-notes-fields
 */
import PocketBase from "pocketbase";

const pbUrl = process.env.PB_URL ?? "https://book.api.cinevault.space";
const email = process.env.PB_SUPERUSER_EMAIL;
const password = process.env.PB_SUPERUSER_PASSWORD;

if (!email || !password) {
  console.error("PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD must be set (.env)");
  process.exit(1);
}

const pb = new PocketBase(pbUrl);
await pb.collection("_superusers").authWithPassword(email, password);

const collection = await pb.collections.getOne("notes");

const existingNames = new Set(
  (collection.fields as Array<{ name: string }>).map((f) => f.name),
);

const newFields = [
  { name: "summary", type: "text", required: false },
  { name: "tags", type: "json", required: false },
  { name: "sentiment", type: "text", required: false },
].filter((f) => !existingNames.has(f.name));

if (newFields.length === 0) {
  console.log("All fields already present, nothing to do.");
  process.exit(0);
}

const updated = await pb.collections.update("notes", {
  fields: [...collection.fields, ...newFields],
});

console.log("Updated `notes` collection fields:");
console.log(JSON.stringify(updated.fields, null, 2));
