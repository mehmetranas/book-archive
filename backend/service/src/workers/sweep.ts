import type { RecordModel } from "pocketbase";
import { pb, withAdminAuth } from "../lib/pocketbase-admin-client.js";
import { buildFilter } from "../lib/pb-filter.js";
import { logger } from "../lib/logger.js";
import { runBookEnrichment } from "./book-enrichment.worker.js";
import { runImageGen } from "./image-gen.worker.js";

const STALE_PROCESSING_MINUTES = 10;
const ORPHANED_PENDING_SECONDS = 30;

interface JobKind {
  statusField: "enrichment_status" | "image_gen_status";
  timeoutMarker: string;
  run: (bookId: string) => Promise<void>;
}

const JOB_KINDS: JobKind[] = [
  { statusField: "enrichment_status", timeoutMarker: "Timeout", run: runBookEnrichment },
  { statusField: "image_gen_status", timeoutMarker: "ImgTimeout", run: runImageGen },
];

/**
 * Safety net for the inline job-trigger pattern: retries/fails stale
 * `processing` records (crash mid-job) and fires anything left `pending`
 * for longer than a fire-and-forget call should ever take (crash right
 * after a route set the status but before the inline trigger ran).
 */
export async function sweepStaleJobs(): Promise<void> {
  const processingThreshold = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000);
  const pendingThreshold = new Date(Date.now() - ORPHANED_PENDING_SECONDS * 1000);

  for (const job of JOB_KINDS) {
    await sweepStaleProcessing(job, processingThreshold);
    await sweepOrphanedPending(job, pendingThreshold);
  }
}

async function sweepStaleProcessing(job: JobKind, threshold: Date): Promise<void> {
  const stale = await withAdminAuth(() =>
    pb.collection("books").getFullList({
      filter: buildFilter(`${job.statusField} = "processing" && updated < {:threshold}`, {
        threshold,
      }),
    }),
  );

  for (const record of stale as RecordModel[]) {
    const notes = String(record.ai_notes ?? "");

    if (notes.includes(job.timeoutMarker)) {
      await withAdminAuth(() =>
        pb.collection("books").update(record.id, {
          [job.statusField]: "failed",
          ai_notes: `${notes} | Final Failure: Max retry reached.`,
        }),
      );
      logger.warn(
        { bookId: record.id, job: job.statusField },
        "[sweep] Giving up after repeated timeout",
      );
      continue;
    }

    await withAdminAuth(() =>
      pb.collection("books").update(record.id, {
        [job.statusField]: "pending",
        ai_notes: `${notes} [${job.timeoutMarker}: Retrying...]`,
      }),
    );
    logger.warn({ bookId: record.id, job: job.statusField }, "[sweep] Stale processing, retrying");
    void job
      .run(record.id)
      .catch((err) =>
        logger.error({ err, bookId: record.id, job: job.statusField }, "[sweep] Retry run failed"),
      );
  }
}

async function sweepOrphanedPending(job: JobKind, threshold: Date): Promise<void> {
  const orphaned = await withAdminAuth(() =>
    pb.collection("books").getFullList({
      filter: buildFilter(`${job.statusField} = "pending" && updated < {:threshold}`, { threshold }),
    }),
  );

  for (const record of orphaned as RecordModel[]) {
    logger.warn({ bookId: record.id, job: job.statusField }, "[sweep] Orphaned pending, firing now");
    void job
      .run(record.id)
      .catch((err) =>
        logger.error({ err, bookId: record.id, job: job.statusField }, "[sweep] Orphaned run failed"),
      );
  }
}
