/**
 * One-off helper for manually testing the service against live PocketBase
 * without touching the mobile app. Prints a user bearer token to stdout.
 *
 * Usage: npm run get-token -- user@example.com password123
 */
import PocketBase from "pocketbase";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: npm run get-token -- <email> <password>");
  process.exit(1);
}

const pbUrl = process.env.PB_URL ?? "https://book.api.cinevault.space";
const pb = new PocketBase(pbUrl);

const { token } = await pb.collection("users").authWithPassword(email, password);
console.log(token);
