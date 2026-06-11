import type { ParseBenchmarkResult, SkeletonFormat } from "../types";
import {
  estimateDroppedFrames,
  FRAME_BUDGET_MS,
} from "./metrics";
import {
  loadSpineAssets,
  parseSkeletonData,
} from "./spineLoader";

export interface ParseBenchmarkOptions {
  format: SkeletonFormat;
  instanceCount: number;
  warmupCount?: number;
}

async function waitForNextFrame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((timestamp) => resolve(timestamp));
  });
}

export async function runParseBenchmark(
  options: ParseBenchmarkOptions,
): Promise<ParseBenchmarkResult> {
  const { format, instanceCount, warmupCount = 3 } = options;
  const assets = await loadSpineAssets(format);

  for (let index = 0; index < warmupCount; index += 1) {
    parseSkeletonData(assets, format);
  }

  await waitForNextFrame();
  const parseStartFrame = performance.now();
  await waitForNextFrame();
  const frameBeforeParse = performance.now();
  const frameGapBeforeParse = frameBeforeParse - parseStartFrame;

  const parseDurations: number[] = [];
  let droppedFramesDuringParse = 0;
  let longestFrameGapMs = frameGapBeforeParse;

  for (let index = 0; index < instanceCount; index += 1) {
    const startedAt = performance.now();
    parseSkeletonData(assets, format);
    const endedAt = performance.now();
    const duration = endedAt - startedAt;
    parseDurations.push(duration);

    const blockingMs = duration;
    droppedFramesDuringParse += estimateDroppedFrames(blockingMs);
    longestFrameGapMs = Math.max(longestFrameGapMs, blockingMs);
  }

  const totalParseMs = parseDurations.reduce((sum, value) => sum + value, 0);

  return {
    format,
    instanceCount,
    fileSizeBytes: assets.fileSizeBytes,
    totalParseMs,
    avgParseMs: totalParseMs / instanceCount,
    minParseMs: Math.min(...parseDurations),
    maxParseMs: Math.max(...parseDurations),
    droppedFramesDuringParse,
    longestFrameGapMs,
  };
}

export function getFrameBudgetMs(): number {
  return FRAME_BUDGET_MS;
}
