import { pb, withAdminAuth } from "../lib/pocketbase-admin-client.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

interface OpenRouterImageResponse {
  data?: { b64_json?: string }[];
}

function buildPrompt(bookTitle: string): string {
  return `
Roleplay as an expert "Bookstagram" photographer and literary curator. I will provide you with a book title. Your task is to create a stunning, atmospheric Instagram post image (square aspect ratio 1:1) based on that book.

Follow these steps precisely:

1. QUOTE SELECTION: Select the most iconic, recognizable, and profound quote from the given book. If it is not already in Turkish, translate it accurately into the Turkish language.

2. MOOD ANALYSIS: Analyze the emotional weight, setting, and central theme of that specific quote and the book itself.

3. VISUAL TRANSLATION: Translate that specific mood into visual elements (Setting, Lighting, Props surrounding the book).

4. COMPOSITION & TYPOGRAPHY (HANDWRITTEN FOCUS):

Centerpiece: The image must feature an open, aged book with blank, textured, off-white pages or a piece of high-quality artisanal paper as the main focus.

The Quote (Crucial): The selected Turkish quote must be rendered as authentic, natural-looking handwriting. It must look genuinely written by a human hand directly onto the page using a traditional fountain pen or dip pen with dark ink. Show realistic details like slight ink texture, pressure variations, or minor imperfections that make it look organic, not printed. The script style should be elegant but personal.

Placement & Size: The handwritten quote must be perfectly centered both vertically and horizontally on the page. The size of the handwriting must be prominent and large enough to be effortlessly readable at a glance on a small screen.

The Book Title: Strictly position the book title in the bottom-right corner using a smaller, clean, non-italicized standard serif font (like EB Garamond) to contrast cleanly with the handwritten element.

Overall Style: The image should be a high-quality, cozy photographic "flat lay" scene.

CREATE THE IMAGE FOR THE BOOK: ${bookTitle}
`;
}

/**
 * Ports pocketjs.image-gen.js. The original hook's temp-file-write + shell
 * `base64 -d` decode + `$filesystem.fileFromPath` dance was a Goja/PocketBase
 * JSVM workaround for having no native base64 decoder - in Node this
 * collapses to `Buffer.from(..., "base64")` uploaded directly as a Blob.
 */
export async function runImageGen(bookId: string): Promise<void> {
  const book = await withAdminAuth(() => pb.collection("books").getOne(bookId));
  const title = String(book.title ?? "");

  await withAdminAuth(() =>
    pb.collection("books").update(bookId, { image_gen_status: "processing" }),
  );

  try {
    const prompt = buildPrompt(title);

    const res = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      // flux.2-klein-4b (the original hook's model) is gone from OpenRouter's
      // catalog - swapped to a current image-generation model. Same
      // /api/v1/images request/response shape (data[0].b64_json), no other
      // changes needed.
      body: JSON.stringify({ model: "krea/krea-2-medium-turbo", prompt }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`API Error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as OpenRouterImageResponse;
    const base64 = data.data?.[0]?.b64_json;
    if (!base64) {
      throw new Error("No base64 image data in API response");
    }

    const buffer = Buffer.from(base64, "base64");
    const formData = new FormData();
    formData.set("image_gen_status", "completed");
    formData.set("image_prompt", prompt);
    formData.set("generated_image", new Blob([buffer], { type: "image/jpeg" }), `${bookId}.jpg`);

    await withAdminAuth(() => pb.collection("books").update(bookId, formData));

    logger.info({ bookId, title }, "[image-gen] Completed");
  } catch (err) {
    logger.error({ err, bookId, title }, "[image-gen] Failed");
    await withAdminAuth(() =>
      pb.collection("books").update(bookId, {
        image_gen_status: "failed",
        ai_notes: `Img Error: ${String(err).substring(0, 150)}`,
      }),
    ).catch(() => undefined);
  }
}
