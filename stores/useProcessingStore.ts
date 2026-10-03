"use client";

import { create } from "zustand";
import type { JobState, ProcessingJob } from "@/types";

/** Key of the default (no variant) output slot. */
export const DEFAULT_SLOT = "default";

/**
 * Jobs are stored per source, per output slot. A slot holds the LATEST job
 * for that (image, variant) pair: processing again replaces it, so there is
 * never a pile of stale results — or stale Blobs — per image.
 */
type JobsBySource = Record<string, Record<string, ProcessingJob>>;

interface ProcessingState {
  jobs: JobsBySource;

  putJobs: (jobs: ProcessingJob[]) => void;
  setJobState: (sourceId: string, slot: string, jobId: string, state: JobState) => void;
  removeJobs: (jobs: Pick<ProcessingJob, "sourceId" | "variantId">[]) => void;
  removeSources: (sourceIds: string[]) => void;
}

export function slotOf(job: Pick<ProcessingJob, "variantId">): string {
  return job.variantId ?? DEFAULT_SLOT;
}

export const useProcessingStore = create<ProcessingState>()((set) => ({
  jobs: {},

  putJobs: (added) =>
    set((state) => {
      const jobs = { ...state.jobs };
      for (const job of added) {
        jobs[job.sourceId] = { ...jobs[job.sourceId], [slotOf(job)]: job };
      }
      return { jobs };
    }),

  setJobState: (sourceId, slot, jobId, jobState) =>
    set((state) => {
      const current = state.jobs[sourceId]?.[slot];
      // The slot may have been replaced or removed while this job was running.
      if (!current || current.id !== jobId) return state;
      return {
        jobs: {
          ...state.jobs,
          [sourceId]: { ...state.jobs[sourceId], [slot]: { ...current, state: jobState } },
        },
      };
    }),

  removeJobs: (removed) =>
    set((state) => {
      const jobs = { ...state.jobs };
      for (const job of removed) {
        const slots = jobs[job.sourceId];
        if (!slots) continue;
        const rest = { ...slots };
        delete rest[slotOf(job)];
        if (Object.keys(rest).length > 0) jobs[job.sourceId] = rest;
        else delete jobs[job.sourceId];
      }
      return { jobs };
    }),

  removeSources: (sourceIds) =>
    set((state) => {
      const jobs = { ...state.jobs };
      for (const id of sourceIds) delete jobs[id];
      return { jobs };
    }),
}));

export function allJobs(jobs: JobsBySource): ProcessingJob[] {
  return Object.values(jobs).flatMap((slots) => Object.values(slots));
}

export function isActive(job: ProcessingJob): boolean {
  return job.state.status === "queued" || job.state.status === "processing";
}
