import { TextureAtlas } from "@esotericsoftware/spine-core";
import type {
  ParseBenchmarkResult,
  SkeletonFormat,
  SpineSkeletonConfig,
} from "../types";
import { spineAssetsConfig } from "./spineConfig";
import {
  parseSkeletonData,
  recordParseSample,
  totalFileSizeBytes,
  type LoadedSpineAsset,
  type ParseSampleAccumulator,
} from "./utils";

export function runParseBenchmarkNode(
  assets: LoadedSpineAsset[],
  format: SkeletonFormat,
  instanceCount: number,
  warmupCount = 5,
): ParseBenchmarkResult {
  for (let index = 0; index < warmupCount; index += 1) {
    for (const asset of assets) {
      parseSkeletonData(asset, format);
    }
  }

  const acc: ParseSampleAccumulator = {
    durations: [],
    droppedFrames: 0,
    longestFrameGapMs: 0,
  };

  for (let round = 0; round < instanceCount; round += 1) {
    for (const asset of assets) {
      recordParseSample(asset, format, acc);
    }
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

export async function loadSpineAssetsFromDisk(
  format: SkeletonFormat,
  assetsDir: string,
  skeletons: SpineSkeletonConfig[] = spineAssetsConfig.skeletons,
): Promise<LoadedSpineAsset[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const atlasCache = new Map<string, TextureAtlas>();
  const assets: LoadedSpineAsset[] = [];

  for (const skeleton of skeletons) {
    let atlas = atlasCache.get(skeleton.atlasPath);
    if (!atlas) {
      const atlasText = await fs.readFile(
        path.join(assetsDir, skeleton.atlasPath),
        "utf8",
      );
      atlas = new TextureAtlas(atlasText);
      atlasCache.set(skeleton.atlasPath, atlas);
    }

    if (format === "json") {
      const skeletonText = await fs.readFile(
        path.join(assetsDir, skeleton.jsonPath),
        "utf8",
      );
      assets.push({
        id: skeleton.id,
        atlas,
        skeletonBytes: new Uint8Array(),
        skeletonText,
        fileSizeBytes: Buffer.byteLength(skeletonText, "utf8"),
      });
      continue;
    }

    const skeletonBytes = new Uint8Array(
      await fs.readFile(path.join(assetsDir, skeleton.skelPath)),
    );
    assets.push({
      id: skeleton.id,
      atlas,
      skeletonBytes,
      skeletonText: "",
      fileSizeBytes: skeletonBytes.byteLength,
    });
  }

  return assets;
}
