import type { ParseBenchmarkResult, SkeletonFormat } from "../types";
import { FRAME_BUDGET_MS } from "./metrics";
import { spineAssetsConfig } from "./spineConfig";
import {
  loadSpineAssets,
  parseSkeletonData,
  recordParseSample,
  totalFileSizeBytes,
  type LoadedSpineAsset,
  type ParseSampleAccumulator,
} from "./utils";

export interface ParseBenchmarkOptions {
  format: SkeletonFormat;
  instanceCount: number;
  warmupCount?: number;
  onProgress?: (done: number, total: number, skeletonId: string) => void;
}

async function waitForNextFrame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((timestamp) => resolve(timestamp));
  });
}

function warmupParse(
  assets: LoadedSpineAsset[],
  format: SkeletonFormat,
  warmupCount: number,
): void {
  for (let index = 0; index < warmupCount; index += 1) {
    for (const asset of assets) {
      parseSkeletonData(asset, format);
    }
  }
}

export async function runParseBenchmark(
  options: ParseBenchmarkOptions,
): Promise<ParseBenchmarkResult> {
  const { format, instanceCount, warmupCount = 3, onProgress } = options;
  const assets = await loadSpineAssets(format, spineAssetsConfig.skeletons);
  const totalSamples = assets.length * instanceCount;

  warmupParse(assets, format, warmupCount);
  await waitForNextFrame();

  const acc: ParseSampleAccumulator = {
    durations: [],
    droppedFrames: 0,
    longestFrameGapMs: 0,
  };

  let done = 0;
  for (let round = 0; round < instanceCount; round += 1) {
    for (const asset of assets) {
      recordParseSample(asset, format, acc);
      done += 1;
      onProgress?.(done, totalSamples, asset.id);
    }
    await waitForNextFrame();
  }

  const totalParseMs = acc.durations.reduce((sum, value) => sum + value, 0);

  return {
    format,
    instanceCount,
    skeletonCount: assets.length,
    fileSizeBytes: totalFileSizeBytes(assets),
    totalParseMs,
    avgParseMs: totalParseMs / acc.durations.length,
    minParseMs: Math.min(...acc.durations),
    maxParseMs: Math.max(...acc.durations),
    droppedFramesDuringParse: acc.droppedFrames,
    longestFrameGapMs: acc.longestFrameGapMs,
  };
}

export function getFrameBudgetMs(): number {
  return FRAME_BUDGET_MS;
}
