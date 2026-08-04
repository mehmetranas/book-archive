const ACTIVE_STATUSES = new Set(['pending', 'processing']);
const POLL_INTERVAL_MS = 4000;

interface StatusFields {
    enrichment_status?: string | null;
    image_gen_status?: string | null;
}

function isActive(status?: string | null): boolean {
    return !!status && ACTIVE_STATUSES.has(status);
}

function hasActiveStatus(record: StatusFields): boolean {
    return (
        isActive(record.enrichment_status) ||
        isActive(record.image_gen_status)
    );
}

/** refetchInterval callback for a single record query (e.g. BookDetailScreen). */
export function recordStatusPoll(record: StatusFields | undefined | null): number | false {
    if (!record) return false;
    return hasActiveStatus(record) ? POLL_INTERVAL_MS : false;
}

/** refetchInterval callback for a list query — polls while any visible item is pending/processing. */
export function listStatusPoll(records: StatusFields[]): number | false {
    return records.some(hasActiveStatus) ? POLL_INTERVAL_MS : false;
}
