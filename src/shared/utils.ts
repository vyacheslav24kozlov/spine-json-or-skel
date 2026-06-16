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
} from "@esotericsoftware/spine-core";
import type { SkeletonFormat } from "../types";
import { estimateDroppedFrames } from "./metrics";

export interface LoadedSpineAssets {
  atlas: TextureAtlas;
  skeletonBytes: Uint8Array;
  skeletonText: string;
  fileSizeBytes: number;
}

export async function loadSpineAssets(
  format: SkeletonFormat,
): Promise<LoadedSpineAssets> {
  const [atlasResponse, skeletonResponse] = await Promise.all([
    fetch("/assets/symbols.atlas"),
    fetch(
      format === "json"
        ? "/assets/animation.json"
        : "/assets/animation.skel",
    ),
  ]);

  if (!atlasResponse.ok || !skeletonResponse.ok) {
    throw new Error(`Failed to load assets for ${format}`);
  }

  const atlasText = await atlasResponse.text();
  const atlas = new TextureAtlas(atlasText);

  if (format === "json") {
    const skeletonText = await skeletonResponse.text();
    return {
      atlas,
      skeletonBytes: new Uint8Array(),
      skeletonText,
      fileSizeBytes: new TextEncoder().encode(skeletonText).length,
    };
  }

  const skeletonBuffer = await skeletonResponse.arrayBuffer();
  const skeletonBytes = new Uint8Array(skeletonBuffer);
  return {
    atlas,
    skeletonBytes,
    skeletonText: "",
    fileSizeBytes: skeletonBytes.byteLength,
  };
}

export function parseSkeletonData(
  assets: LoadedSpineAssets,
  format: SkeletonFormat,
): SkeletonData {
  const attachmentLoader = new AtlasAttachmentLoader(assets.atlas);

  if (format === "json") {
    const skeletonJson = new SkeletonJson(attachmentLoader);
    return skeletonJson.readSkeletonData(assets.skeletonText);
  }

  const skeletonBinary = new SkeletonBinary(attachmentLoader);
  return skeletonBinary.readSkeletonData(assets.skeletonBytes);
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
  skeletonData: SkeletonData,
  animationName: string,
  instanceCount: number,
  warmupCount = 3,
): CreateRuntimeInstancesBenchmark {
  for (let index = 0; index < warmupCount; index += 1) {
    createRuntimeInstance(skeletonData, animationName);
  }

  const createDurations: number[] = [];
  let droppedFramesDuringCreate = 0;
  let longestFrameGapMs = 0;
  const instances: RuntimeInstance[] = [];

  for (let index = 0; index < instanceCount; index += 1) {
    const startedAt = performance.now();
    instances.push(createRuntimeInstance(skeletonData, animationName));
    const endedAt = performance.now();
    const duration = endedAt - startedAt;
    createDurations.push(duration);

    droppedFramesDuringCreate += estimateDroppedFrames(duration);
    longestFrameGapMs = Math.max(longestFrameGapMs, duration);
  }

  const totalCreateMs = createDurations.reduce((sum, value) => sum + value, 0);

  return {
    instances,
    totalCreateMs,
    avgCreateMs: totalCreateMs / instanceCount,
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
