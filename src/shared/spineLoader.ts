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
        ? "/assets/animation_minor.json"
        : "/assets/animation_minor.skel",
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

export function updateRuntimeInstance(
  instance: RuntimeInstance,
  deltaSec: number,
): void {
  instance.animationState.update(deltaSec);
  instance.animationState.apply(instance.skeleton);
  instance.skeleton.updateWorldTransform(Physics.update);
}
