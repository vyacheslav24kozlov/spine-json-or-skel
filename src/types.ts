export type SkeletonFormat = "json" | "skel";

export const ANIMATION_GROUP_COUNT = 4;

export interface SpineSkeletonConfig {
  id: string;
  jsonPath: string;
  skelPath: string;
  atlasPath: string;
  animations: string[];
}

export interface SpineAnimationGroupEntry {
  skeletonId: string;
  animationName: string;
}

export interface SpineAnimationGroup {
  id: number;
  animationIndex: number;
  entries: SpineAnimationGroupEntry[];
}

export interface SpineAssetsConfig {
  generatedAt: string;
  assetsRoot: string;
  skeletons: SpineSkeletonConfig[];
  animationGroups: SpineAnimationGroup[];
}

export interface ParseBenchmarkResult {
  format: SkeletonFormat;
  instanceCount: number;
  skeletonCount: number;
  fileSizeBytes: number;
  totalParseMs: number;
  avgParseMs: number;
  minParseMs: number;
  maxParseMs: number;
  droppedFramesDuringParse: number;
  longestFrameGapMs: number;
}

export interface PlaybackBenchmarkResult {
  format: SkeletonFormat;
  instanceCount: number;
  skeletonCount: number;
  animationGroupId: number;
  animationName: string;
  durationSec: number;
  totalFrames: number;
  avgFps: number;
  minFps: number;
  droppedFrames: number;
  frameTimeP95Ms: number;
  instanceCreate: InstanceCreateBenchmarkResult;
}

export interface InstanceCreateBenchmarkResult {
  format: SkeletonFormat;
  instanceCount: number;
  skeletonCount: number;
  animationGroupId: number;
  animationName: string;
  totalCreateMs: number;
  avgCreateMs: number;
  minCreateMs: number;
  maxCreateMs: number;
  droppedFramesDuringCreate: number;
  longestFrameGapMs: number;
}

export interface BenchmarkSuiteResult {
  parse: ParseBenchmarkResult;
  playback: PlaybackBenchmarkResult;
}
