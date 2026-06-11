const TARGET_FPS = 60;
export const FRAME_BUDGET_MS = 1000 / TARGET_FPS;

export function summarizeFrameTimes(frameTimesMs: number[]) {
  if (frameTimesMs.length === 0) {
    return {
      avgFps: 0,
      minFps: 0,
      droppedFrames: 0,
      frameTimeP95Ms: 0,
    };
  }

  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const avgFrameMs =
    frameTimesMs.reduce((sum, value) => sum + value, 0) / frameTimesMs.length;
  const maxFrameMs = sorted[sorted.length - 1];
  const p95Index = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * 0.95),
  );
  const droppedFrames = frameTimesMs.filter(
    (frameMs) => frameMs > FRAME_BUDGET_MS * 1.5,
  ).length;

  return {
    avgFps: 1000 / avgFrameMs,
    minFps: 1000 / maxFrameMs,
    droppedFrames,
    frameTimeP95Ms: sorted[p95Index],
  };
}

export function estimateDroppedFrames(blockingMs: number): number {
  if (blockingMs <= FRAME_BUDGET_MS) {
    return 0;
  }
  return Math.floor(blockingMs / FRAME_BUDGET_MS);
}

export function formatMs(value: number): string {
  return `${value.toFixed(2)} ms`;
}

export function formatFps(value: number): string {
  return `${value.toFixed(1)} FPS`;
}

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  return `${(value / 1024).toFixed(1)} KB`;
}
