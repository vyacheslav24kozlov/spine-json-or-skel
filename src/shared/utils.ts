import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  Physics,
  Skeleton,
  SkeletonBinary,
  SkeletonData,
  SkeletonJson,
  TextureAtlas,
  TextureAtlasRegion,
} from "@esotericsoftware/spine-core";
import { spineAssetsConfig } from "./spineConfig";
import type { SkeletonFormat, SpineSkeletonConfig } from "../types";
import { estimateDroppedFrames } from "./metrics";
import path from "node:path";
import fs from "node:fs/promises";

const atlasesWithMissingRegionStub = new WeakSet<TextureAtlas>();

function stubMissingAtlasRegion(atlas: TextureAtlas, name: string): TextureAtlasRegion {
  const page = atlas.pages[0];
  if (!page) {
    throw new Error(`Atlas has no pages; cannot stub region ${name}`);
  }

  const region = new TextureAtlasRegion(page, name);
  region.width = 1;
  region.height = 1;
  region.originalWidth = 1;
  region.originalHeight = 1;
  region.u = 0;
  region.v = 0;
  region.u2 = page.width > 0 ? 1 / page.width : 1;
  region.v2 = page.height > 0 ? 1 / page.height : 1;
  atlas.regions.push(region);
  return region;
}

function allowMissingAtlasRegions(atlas: TextureAtlas): void {
  if (atlasesWithMissingRegionStub.has(atlas)) {
    return;
  }

  atlasesWithMissingRegionStub.add(atlas);
  const originalFindRegion = atlas.findRegion.bind(atlas);
  atlas.findRegion = (name: string) => {
    const region = originalFindRegion(name);
    if (region) {
      return region;
    }
    return stubMissingAtlasRegion(atlas, name);
  };
}

export interface LoadedSpineAssets {
  atlas: TextureAtlas;
  skeletonBytes: Uint8Array;
  skeletonText: string;
  fileSizeBytes: number;
}

export interface LoadedSpineAsset extends LoadedSpineAssets {
  id: string;
}

const ASSETS_BASE = spineAssetsConfig.assetsRoot;

async function fetchAsset(path: string): Promise<Response> {
  const response = await fetch(`${ASSETS_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`);
  }
  return response;
}

async function loadAtlasMap(
  skeletons: SpineSkeletonConfig[],
): Promise<Map<string, TextureAtlas>> {
  const uniqueAtlasPaths = [...new Set(skeletons.map((item) => item.atlasPath))];
  const atlasEntries = await Promise.all(
    uniqueAtlasPaths.map(async (atlasPath) => {
      const atlasText = await (await fetchAsset(atlasPath)).text();
      return [atlasPath, new TextureAtlas(atlasText)] as const;
    }),
  );
  return new Map(atlasEntries);
}

export async function loadSpineAssets(
  format: SkeletonFormat,
  skeletons: SpineSkeletonConfig[] = spineAssetsConfig.skeletons,
): Promise<LoadedSpineAsset[]> {
  const atlasMap = await loadAtlasMap(skeletons);

  return Promise.all(
    skeletons.map(async (skeleton) => {
      const atlas = atlasMap.get(skeleton.atlasPath);
      if (!atlas) {
        throw new Error(`Atlas not loaded: ${skeleton.atlasPath}`);
      }

      if (format === "json") {
        const skeletonText = await (await fetchAsset(skeleton.jsonPath)).text();
        return {
          id: skeleton.id,
          atlas,
          skeletonBytes: new Uint8Array(),
          skeletonText,
          fileSizeBytes: new TextEncoder().encode(skeletonText).length,
        };
      }

      const skeletonBuffer = await (await fetchAsset(skeleton.skelPath)).arrayBuffer();
      const skeletonBytes = new Uint8Array(skeletonBuffer);
      return {
        id: skeleton.id,
        atlas,
        skeletonBytes,
        skeletonText: "",
        fileSizeBytes: skeletonBytes.byteLength,
      };
    }),
  );
}

export function parseSkeletonData(
  assets: LoadedSpineAssets,
  format: SkeletonFormat,
): SkeletonData {
  allowMissingAtlasRegions(assets.atlas);
  const attachmentLoader = new AtlasAttachmentLoader(assets.atlas);
  const skeletonId = "id" in assets ? String(assets.id) : "skeleton";

  try {
    if (format === "json") {
      const skeletonJson = new SkeletonJson(attachmentLoader);
      return skeletonJson.readSkeletonData(assets.skeletonText);
    }

    const skeletonBinary = new SkeletonBinary(attachmentLoader);
    return skeletonBinary.readSkeletonData(assets.skeletonBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${skeletonId} (${format}): ${message}`);
  }
}

export interface ParseSampleAccumulator {
  durations: number[];
  droppedFrames: number;
  longestFrameGapMs: number;
}

/**
 * Парсит скелет один раз, измеряет длительность и обновляет аккумулятор
 * статистикой по этой итерации (длительность, пропущенные кадры, макс. задержка).
 */
export function recordParseSample(
  assets: LoadedSpineAssets,
  format: SkeletonFormat,
  acc: ParseSampleAccumulator,
): void {
  const startedAt = performance.now();
  parseSkeletonData(assets, format);
  const endedAt = performance.now();
  const duration = endedAt - startedAt;
  acc.durations.push(duration);

  acc.droppedFrames += estimateDroppedFrames(duration);
  acc.longestFrameGapMs = Math.max(acc.longestFrameGapMs, duration);
}

export function totalFileSizeBytes(assets: LoadedSpineAsset[]): number {
  return assets.reduce((sum, item) => sum + item.fileSizeBytes, 0);
}

export interface RuntimeInstance {
  skeleton: Skeleton;
  animationState: AnimationState;
}

export function createRuntimeInstance(
  skeletonData: SkeletonData,
  animationName: string,
): RuntimeInstance {
  const skeleton = new Skeleton(skeletonData);
  const animationStateData = new AnimationStateData(skeletonData);
  const animationState = new AnimationState(animationStateData);
  animationState.setAnimation(0, animationName, true);
  return { skeleton, animationState };
}

export interface SkeletonPlaybackSpec {
  skeletonData: SkeletonData;
  animationName: string;
}

export interface CreateRuntimeInstancesBenchmark {
  instances: RuntimeInstance[];
  totalCreateMs: number;
  avgCreateMs: number;
  minCreateMs: number;
  maxCreateMs: number;
  droppedFramesDuringCreate: number;
  longestFrameGapMs: number;
}

export function benchmarkCreateRuntimeInstances(
  specs: SkeletonPlaybackSpec[],
  copiesPerSkeleton: number,
  warmupCount = 1,
): CreateRuntimeInstancesBenchmark {
  if (specs.length === 0) {
    throw new Error("No skeletons to instantiate");
  }

  for (let warmupIndex = 0; warmupIndex < warmupCount; warmupIndex += 1) {
    for (const spec of specs) {
      createRuntimeInstance(spec.skeletonData, spec.animationName);
    }
  }

  const createDurations: number[] = [];
  let droppedFramesDuringCreate = 0;
  let longestFrameGapMs = 0;
  const instances: RuntimeInstance[] = [];

  for (let copyIndex = 0; copyIndex < copiesPerSkeleton; copyIndex += 1) {
    for (const spec of specs) {
      const startedAt = performance.now();
      instances.push(
        createRuntimeInstance(spec.skeletonData, spec.animationName),
      );
      const endedAt = performance.now();
      const duration = endedAt - startedAt;
      createDurations.push(duration);

      droppedFramesDuringCreate += estimateDroppedFrames(duration);
      longestFrameGapMs = Math.max(longestFrameGapMs, duration);
    }
  }

  const totalCreateMs = createDurations.reduce((sum, value) => sum + value, 0);

  return {
    instances,
    totalCreateMs,
    avgCreateMs: totalCreateMs / createDurations.length,
    minCreateMs: Math.min(...createDurations),
    maxCreateMs: Math.max(...createDurations),
    droppedFramesDuringCreate,
    longestFrameGapMs,
  };
}

export function updateRuntimeInstance(
  instance: RuntimeInstance,
  deltaSec: number,
): void {
  instance.animationState.update(deltaSec);
  instance.animationState.apply(instance.skeleton);
  instance.skeleton.updateWorldTransform(Physics.update);
}

/* CLI SCRIPT */

export function toAssetPath(assetsDir: string, absolutePath: string): string {
  return path.relative(assetsDir, absolutePath).split(path.sep).join("/");
}

export async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(fullPath);
      }
      return [fullPath];
    }),
  );
  return files.flat();
}
