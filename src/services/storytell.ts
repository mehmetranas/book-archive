import { pb } from './pocketbase';

export interface StoryTellRecord {
    id: string;
    url: string;
}

/**
 * Lookup priority: ISBN → google_books_id → title (~contains)
 * Returns null (never throws) when nothing is found.
 */
export async function findStoryTell(params: {
    isbn?: string;
    google_books_id?: string;
    title: string;
}): Promise<StoryTellRecord | null> {
    const { isbn, google_books_id, title } = params;

    if (isbn) {
        try {
            return await pb.collection('storytell').getFirstListItem<StoryTellRecord>(`isbn = "${isbn}"`);
        } catch {}
    }

    if (google_books_id) {
        try {
            return await pb.collection('storytell').getFirstListItem<StoryTellRecord>(`google_books_id = "${google_books_id}"`);
        } catch {}
    }

    try {
        const safeTitle = title.replace(/"/g, '\\"');
        return await pb.collection('storytell').getFirstListItem<StoryTellRecord>(`title ~ "${safeTitle}"`);
    } catch {
        return null;
    }
}
