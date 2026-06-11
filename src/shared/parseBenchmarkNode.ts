import { TextureAtlas } from "@esotericsoftware/spine-core";
import type { ParseBenchmarkResult, SkeletonFormat } from "../types";
import { estimateDroppedFrames } from "./metrics";
import {
  parseSkeletonData,
  type LoadedSpineAssets,
} from "./spineLoader";

export type { LoadedSpineAssets } from "./spineLoader";

export function runParseBenchmarkNode(
  assets: LoadedSpineAssets,
  format: SkeletonFormat,
  instanceCount: number,
  warmupCount = 5,
): ParseBenchmarkResult {
  for (let index = 0; index < warmupCount; index += 1) {
    parseSkeletonData(assets, format);
  }

  const parseDurations: number[] = [];
  let droppedFramesDuringParse = 0;
  let longestFrameGapMs = 0;

  for (let index = 0; index < instanceCount; index += 1) {
    const startedAt = performance.now();
    parseSkeletonData(assets, format);
    const endedAt = performance.now();
    const duration = endedAt - startedAt;
    parseDurations.push(duration);

    droppedFramesDuringParse += estimateDroppedFrames(duration);
    longestFrameGapMs = Math.max(longestFrameGapMs, duration);
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

export async function loadSpineAssetsFromDisk(
  format: SkeletonFormat,
  assetsDir: string,
): Promise<LoadedSpineAssets> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const atlasText = await fs.readFile(
    path.join(assetsDir, "symbols.atlas"),
    "utf8",
  );
  const atlas = new TextureAtlas(atlasText);

  if (format === "json") {
    const skeletonText = await fs.readFile(
      path.join(assetsDir, "animation_minor.json"),
      "utf8",
    );
    return {
      atlas,
      skeletonBytes: new Uint8Array(),
      skeletonText,
      fileSizeBytes: Buffer.byteLength(skeletonText, "utf8"),
    };
  }

  const skeletonBytes = new Uint8Array(
    await fs.readFile(path.join(assetsDir, "animation_minor.skel")),
  );
  return {
    atlas,
    skeletonBytes,
    skeletonText: "",
    fileSizeBytes: skeletonBytes.byteLength,
  };
}
