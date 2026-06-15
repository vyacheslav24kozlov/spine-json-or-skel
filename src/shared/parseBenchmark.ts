import type { ParseBenchmarkResult, SkeletonFormat } from "../types";
import { FRAME_BUDGET_MS } from "./metrics";
import {
  loadSpineAssets,
  parseSkeletonData,
  recordParseSample,
  type ParseSampleAccumulator,
} from "./utils";

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

  // Синхронизуемся с фреймом браузера перед тестом
  await waitForNextFrame();

  const acc: ParseSampleAccumulator = {
    durations: [],
    droppedFrames: 0,
    longestFrameGapMs: 0,
  };

  for (let index = 0; index < instanceCount; index += 1) {
    recordParseSample(assets, format, acc);

    // Добавить ожидание между итерациями для более реалистичного тестирования
    await waitForNextFrame();
  }

  const totalParseMs = acc.durations.reduce((sum, value) => sum + value, 0);

  return {
    format,
    instanceCount,
    fileSizeBytes: assets.fileSizeBytes,
    totalParseMs,
    avgParseMs: totalParseMs / instanceCount,
    minParseMs: Math.min(...acc.durations),
    maxParseMs: Math.max(...acc.durations),
    droppedFramesDuringParse: acc.droppedFrames,
    longestFrameGapMs: acc.longestFrameGapMs,
  };
}

export function getFrameBudgetMs(): number {
  return FRAME_BUDGET_MS;
}
