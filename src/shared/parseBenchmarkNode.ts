import { TextureAtlas } from "@esotericsoftware/spine-core";
import type { ParseBenchmarkResult, SkeletonFormat } from "../types";
import {
  parseSkeletonData,
  recordParseSample,
  type LoadedSpineAssets,
  type ParseSampleAccumulator,
} from "./utils";

export function runParseBenchmarkNode(
  assets: LoadedSpineAssets,
  format: SkeletonFormat,
  instanceCount: number,
  warmupCount = 5,
): ParseBenchmarkResult {
  for (let index = 0; index < warmupCount; index += 1) {
    parseSkeletonData(assets, format);
  }

  const acc: ParseSampleAccumulator = {
    durations: [],
    droppedFrames: 0,
    longestFrameGapMs: 0,
  };

  for (let index = 0; index < instanceCount; index += 1) {
    recordParseSample(assets, format, acc);
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
      path.join(assetsDir, "animation.json"),
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
    await fs.readFile(path.join(assetsDir, "animation.skel")),
  );
  return {
    atlas,
    skeletonBytes,
    skeletonText: "",
    fileSizeBytes: skeletonBytes.byteLength,
  };
}
