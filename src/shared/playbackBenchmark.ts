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
  benchmarkCreateRuntimeInstances,
  parseSkeletonData,
  updateRuntimeInstance,
  type LoadedSpineAssets,
  type RuntimeInstance,
} from "./spineLoader";

export interface PlaybackBenchmarkOptions {
  canvas: HTMLCanvasElement;
  format: SkeletonFormat;
  instanceCount: number;
  animationName: string;
  durationSec: number;
}

async function loadAssetsForPlayback(
  canvas: HTMLCanvasElement,
  format: SkeletonFormat,
): Promise<LoadedSpineAssets> {
  const context = new ManagedWebGLRenderingContext(canvas);
  const assetManager = new AssetManager(context, "/assets/");
  assetManager.loadTextureAtlas("symbols.atlas");

  if (format === "json") {
    assetManager.loadText("animation_minor.json");
  } else {
    assetManager.loadBinary("animation_minor.skel");
  }

  while (!assetManager.isLoadingComplete()) {
    await assetManager.loadAll();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  if (assetManager.hasErrors()) {
    throw new Error(
      Object.values(assetManager.getErrors()).join("\n"),
    );
  }

  const atlas = assetManager.require("symbols.atlas");
  if (format === "json") {
    const skeletonText = assetManager.require("animation_minor.json") as string;
    return {
      atlas,
      skeletonBytes: new Uint8Array(),
      skeletonText,
      fileSizeBytes: new TextEncoder().encode(skeletonText).length,
    };
  }

  const skeletonBytes = assetManager.require(
    "animation_minor.skel",
  ) as Uint8Array;
  return {
    atlas,
    skeletonBytes,
    skeletonText: "",
    fileSizeBytes: skeletonBytes.byteLength,
  };
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
  const scale = Math.min(cellWidth, cellHeight) / 220;
  const boundsOffset = new Vector2();
  const boundsSize = new Vector2();

  instances.forEach((instance, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const skeleton = instance.skeleton;

    skeleton.setToSetupPose();
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
  const { canvas, format, instanceCount, animationName, durationSec } = options;

  const assets = await loadAssetsForPlayback(canvas, format);
  const skeletonData = parseSkeletonData(assets, format);
  const instanceCreateBenchmark = benchmarkCreateRuntimeInstances(
    skeletonData,
    animationName,
    instanceCount,
  );
  const instances = instanceCreateBenchmark.instances;

  const context = new ManagedWebGLRenderingContext(canvas);
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

  return {
    format,
    instanceCount,
    animationName,
    durationSec,
    totalFrames: frameTimesMs.length,
    avgFps: stats.avgFps,
    minFps: stats.minFps,
    droppedFrames: stats.droppedFrames,
    frameTimeP95Ms: stats.frameTimeP95Ms,
    instanceCreate: {
      format,
      instanceCount,
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
