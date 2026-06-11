export type SkeletonFormat = "json" | "skel";

export interface ParseBenchmarkResult {
  format: SkeletonFormat;
  instanceCount: number;
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
  animationName: string;
  durationSec: number;
  totalFrames: number;
  avgFps: number;
  minFps: number;
  droppedFrames: number;
  frameTimeP95Ms: number;
}

export interface BenchmarkSuiteResult {
  parse: ParseBenchmarkResult;
  playback: PlaybackBenchmarkResult;
}
