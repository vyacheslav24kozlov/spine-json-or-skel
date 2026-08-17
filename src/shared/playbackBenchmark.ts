import {
  AssetManager,
  ManagedWebGLRenderingContext,
  ResizeMode,
  SceneRenderer,
} from "@esotericsoftware/spine-webgl";
import { Physics, Vector2 } from "@esotericsoftware/spine-core";
import type { PlaybackBenchmarkResult, SkeletonFormat } from "../types";
import { summarizeFrameTimes } from "./metrics";
import {
  formatAnimationGroupLabel,
  getAnimationGroup,
  getSkeletonsForGroup,
} from "./spineConfig";
import {
  benchmarkCreateRuntimeInstances,
  parseSkeletonData,
  updateRuntimeInstance,
  type LoadedSpineAsset,
  type RuntimeInstance,
  type SkeletonPlaybackSpec,
} from "./utils";

export interface PlaybackBenchmarkOptions {
  canvas: HTMLCanvasElement;
  format: SkeletonFormat;
  instanceCount: number;
  animationGroupId: number;
  durationSec: number;
}

async function loadAssetsForPlayback(
  context: ManagedWebGLRenderingContext,
  format: SkeletonFormat,
  animationGroupId: number,
): Promise<LoadedSpineAsset[]> {
  const groupItems = getSkeletonsForGroup(animationGroupId);
  const skeletons = groupItems.map((item) => item.skeleton);
  const assetManager = new AssetManager(context, "/assets/");
  const uniqueAtlasPaths = [...new Set(skeletons.map((item) => item.atlasPath))];

  for (const atlasPath of uniqueAtlasPaths) {
    assetManager.loadTextureAtlas(atlasPath);
  }

  for (const skeleton of skeletons) {
    if (format === "json") {
      assetManager.loadText(skeleton.jsonPath);
    } else {
      assetManager.loadBinary(skeleton.skelPath);
    }
  }

  while (!assetManager.isLoadingComplete()) {
    await assetManager.loadAll();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  if (assetManager.hasErrors()) {
    throw new Error(Object.values(assetManager.getErrors()).join("\n"));
  }

  return skeletons.map((skeleton) => {
    const atlas = assetManager.require(skeleton.atlasPath);
    if (format === "json") {
      const skeletonText = assetManager.require(skeleton.jsonPath) as string;
      return {
        id: skeleton.id,
        atlas,
        skeletonBytes: new Uint8Array(),
        skeletonText,
        fileSizeBytes: new TextEncoder().encode(skeletonText).length,
      };
    }

    const skeletonBytes = assetManager.require(skeleton.skelPath) as Uint8Array;
    return {
      id: skeleton.id,
      atlas,
      skeletonBytes,
      skeletonText: "",
      fileSizeBytes: skeletonBytes.byteLength,
    };
  });
}

function layoutInstances(
  instances: RuntimeInstance[],
  viewportWidth: number,
  viewportHeight: number,
): void {
  const columns = Math.ceil(Math.sqrt(instances.length));
  const rows = Math.ceil(instances.length / columns);
  const cellWidth = viewportWidth / columns;
  const cellHeight = viewportHeight / rows;
  const boundsOffset = new Vector2();
  const boundsSize = new Vector2();

  instances.forEach((instance, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const skeleton = instance.skeleton;

    skeleton.setToSetupPose();
    skeleton.scaleX = 1;
    skeleton.scaleY = 1;
    skeleton.updateWorldTransform(Physics.update);
    skeleton.getBounds(boundsOffset, boundsSize);

    const padding = 0.85;
    const scaleX = boundsSize.x > 0 ? (cellWidth * padding) / boundsSize.x : 1;
    const scaleY = boundsSize.y > 0 ? (cellHeight * padding) / boundsSize.y : 1;
    const scale = Math.min(scaleX, scaleY);

    skeleton.scaleX = scale;
    skeleton.scaleY = scale;
    skeleton.updateWorldTransform(Physics.update);
    skeleton.getBounds(boundsOffset, boundsSize);

    const cellCenterX = -viewportWidth / 2 + (column + 0.5) * cellWidth;
    const cellCenterY = viewportHeight / 2 - (row + 0.5) * cellHeight;
    const visualCenterX = boundsOffset.x + boundsSize.x / 2;
    const visualCenterY = boundsOffset.y + boundsSize.y / 2;

    skeleton.x = cellCenterX - visualCenterX;
    skeleton.y = cellCenterY - visualCenterY;
  });
}

export async function runPlaybackBenchmark(
  options: PlaybackBenchmarkOptions,
): Promise<PlaybackBenchmarkResult> {
  const { canvas, format, instanceCount, animationGroupId, durationSec } =
    options;
  const group = getAnimationGroup(animationGroupId);
  if (group.entries.length === 0) {
    throw new Error(
      `В группе ${animationGroupId} нет скелетов с ${animationGroupId}-й анимацией`,
    );
  }

  const animationName = formatAnimationGroupLabel(group);
  const context = new ManagedWebGLRenderingContext(canvas);
  const assets = await loadAssetsForPlayback(context, format, animationGroupId);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const specs: SkeletonPlaybackSpec[] = getSkeletonsForGroup(animationGroupId).map(
    ({ skeleton, animationName: skeletonAnimation }) => {
      const loaded = assetsById.get(skeleton.id);
      if (!loaded) {
        throw new Error(`Loaded assets missing for ${skeleton.id}`);
      }
      return {
        skeletonData: parseSkeletonData(loaded, format),
        animationName: skeletonAnimation,
      };
    },
  );

  const instanceCreateBenchmark = benchmarkCreateRuntimeInstances(
    specs,
    instanceCount,
  );
  const instances = instanceCreateBenchmark.instances;

  const renderer = new SceneRenderer(canvas, context);
  const gl = context.gl;
  renderer.resize(ResizeMode.Expand);
  layoutInstances(
    instances,
    renderer.camera.viewportWidth,
    renderer.camera.viewportHeight,
  );

  const frameTimesMs: number[] = [];
  let previousTimestamp = performance.now();
  const endAt = previousTimestamp + durationSec * 1000;

  while (performance.now() < endAt) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame((timestamp) => {
        const deltaSec = Math.max((timestamp - previousTimestamp) / 1000, 0);
        previousTimestamp = timestamp;
        frameTimesMs.push(deltaSec * 1000);

        instances.forEach((instance) => {
          updateRuntimeInstance(instance, deltaSec);
        });

        renderer.resize(ResizeMode.Expand);
        gl.clearColor(0.08, 0.1, 0.14, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        renderer.begin();
        instances.forEach((instance) => {
          renderer.drawSkeleton(instance.skeleton, true);
        });
        renderer.end();

        resolve();
      });
    });
  }

  const stats = summarizeFrameTimes(frameTimesMs);
  const totalInstances = instances.length;

  return {
    format,
    instanceCount: totalInstances,
    skeletonCount: group.entries.length,
    animationGroupId,
    animationName,
    durationSec,
    totalFrames: frameTimesMs.length,
    avgFps: stats.avgFps,
    minFps: stats.minFps,
    droppedFrames: stats.droppedFrames,
    frameTimeP95Ms: stats.frameTimeP95Ms,
    instanceCreate: {
      format,
      instanceCount: totalInstances,
      skeletonCount: group.entries.length,
      animationGroupId,
      animationName,
      totalCreateMs: instanceCreateBenchmark.totalCreateMs,
      avgCreateMs: instanceCreateBenchmark.avgCreateMs,
      minCreateMs: instanceCreateBenchmark.minCreateMs,
      maxCreateMs: instanceCreateBenchmark.maxCreateMs,
      droppedFramesDuringCreate: instanceCreateBenchmark.droppedFramesDuringCreate,
      longestFrameGapMs: instanceCreateBenchmark.longestFrameGapMs,
    },
  };
}
