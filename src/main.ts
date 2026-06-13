import { runParseBenchmark } from "./shared/parseBenchmark";
import { runPlaybackBenchmark } from "./shared/playbackBenchmark";
import {
  formatBytes,
  formatFps,
  formatMs,
} from "./shared/metrics";
import type {
  BenchmarkSuiteResult,
  InstanceCreateBenchmarkResult,
  ParseBenchmarkResult,
  PlaybackBenchmarkResult,
} from "./types";

const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const resultsEl = document.querySelector<HTMLDivElement>("#results")!;
const runButton = document.querySelector<HTMLButtonElement>("#run-benchmark")!;
const instanceCountInput =
  document.querySelector<HTMLInputElement>("#instance-count")!;
const animationNameSelect =
  document.querySelector<HTMLSelectElement>("#animation-name")!;
const playbackDurationInput =
  document.querySelector<HTMLInputElement>("#playback-duration")!;
const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;

function setStatus(text: string, state: "idle" | "running" | "done" | "error") {
  statusEl.textContent = text;
  statusEl.className = `status ${state === "idle" ? "" : state}`;
}

function renderMetricCard(
  title: string,
  metrics: Array<[string, string]>,
): string {
  const rows = metrics
    .map(
      ([label, value]) =>
        `<dt>${label}</dt><dd>${value}</dd>`,
    )
    .join("");

  return `
    <article class="result-card">
      <h3>${title}</h3>
      <dl>${rows}</dl>
    </article>
  `;
}

function renderParseCard(result: ParseBenchmarkResult): string {
  return renderMetricCard(`Парсинг — ${result.format.toUpperCase()}`, [
    ["Размер файла", formatBytes(result.fileSizeBytes)],
    ["Всего", formatMs(result.totalParseMs)],
    ["Среднее на копию", formatMs(result.avgParseMs)],
    ["Min / Max", `${formatMs(result.minParseMs)} / ${formatMs(result.maxParseMs)}`],
    ["Просадки при парсинге", String(result.droppedFramesDuringParse)],
    ["Макс. блокировка кадра", formatMs(result.longestFrameGapMs)],
  ]);
}

function renderPlaybackCard(result: PlaybackBenchmarkResult): string {
  return renderMetricCard(`Playback — ${result.format.toUpperCase()}`, [
    ["Анимация", result.animationName],
    ["Средний FPS", formatFps(result.avgFps)],
    ["Минимальный FPS", formatFps(result.minFps)],
    ["Кадров", String(result.totalFrames)],
    ["Просадки (>150% budget)", String(result.droppedFrames)],
    ["P95 frame time", formatMs(result.frameTimeP95Ms)],
  ]);
}

function renderInstanceCreateCard(result: InstanceCreateBenchmarkResult): string {
  return renderMetricCard(`Создание инстансов — ${result.format.toUpperCase()}`, [
    ["Анимация", result.animationName],
    ["Инстансов", String(result.instanceCount)],
    ["Всего", formatMs(result.totalCreateMs)],
    ["Среднее на инстанс", formatMs(result.avgCreateMs)],
    ["Min / Max", `${formatMs(result.minCreateMs)} / ${formatMs(result.maxCreateMs)}`],
    ["Просадки при создании", String(result.droppedFramesDuringCreate)],
    ["Макс. блокировка кадра", formatMs(result.longestFrameGapMs)],
  ]);
}

function renderInstanceCreateComparison(
  json: InstanceCreateBenchmarkResult,
  skel: InstanceCreateBenchmarkResult,
): string {
  const createSpeedup = json.totalCreateMs / skel.totalCreateMs;

  return `
    <section class="comparison instance-create-comparison">
      <h3>Сравнение создания инстансов</h3>
      <dl>
        <dt>SKEL быстрее создаёт инстансы</dt>
        <dd>${createSpeedup.toFixed(2)}x</dd>
        <dt>Экономия времени создания</dt>
        <dd>${formatMs(json.totalCreateMs - skel.totalCreateMs)}</dd>
        <dt>Разница среднего на инстанс</dt>
        <dd>${formatMs(json.avgCreateMs - skel.avgCreateMs)} (JSON − SKEL)</dd>
      </dl>
    </section>
  `;
}

function renderComparison(
  json: BenchmarkSuiteResult,
  skel: BenchmarkSuiteResult,
): string {
  const parseSpeedup = json.parse.totalParseMs / skel.parse.totalParseMs;
  const playbackFpsDelta =
    skel.playback.avgFps - json.playback.avgFps;
  const sizeReduction =
    ((json.parse.fileSizeBytes - skel.parse.fileSizeBytes) /
      json.parse.fileSizeBytes) *
    100;

  return `
    <section class="comparison">
      <h3>Сравнение</h3>
      <dl>
        <dt>SKEL быстрее парсится</dt>
        <dd>${parseSpeedup.toFixed(2)}x</dd>
        <dt>SKEL меньше по размеру</dt>
        <dd>${sizeReduction.toFixed(1)}%</dd>
        <dt>Экономия времени парсинга</dt>
        <dd>${formatMs(json.parse.totalParseMs - skel.parse.totalParseMs)}</dd>
        <dt>Разница FPS при playback</dt>
        <dd>${playbackFpsDelta >= 0 ? "+" : ""}${playbackFpsDelta.toFixed(1)} FPS (SKEL vs JSON)</dd>
      </dl>
    </section>
  `;
}

function renderResults(
  json: BenchmarkSuiteResult,
  skel: BenchmarkSuiteResult,
): void {
  resultsEl.innerHTML = [
    renderParseCard(json.parse),
    renderParseCard(skel.parse),
    renderInstanceCreateCard(json.playback.instanceCreate),
    renderInstanceCreateCard(skel.playback.instanceCreate),
    renderInstanceCreateComparison(
      json.playback.instanceCreate,
      skel.playback.instanceCreate,
    ),
    renderPlaybackCard(json.playback),
    renderPlaybackCard(skel.playback),
    renderComparison(json, skel),
  ].join("");
}

async function runFullBenchmark(): Promise<void> {
  const instanceCount = Number(instanceCountInput.value);
  const animationName = animationNameSelect.value;
  const playbackDuration = Number(playbackDurationInput.value);

  runButton.disabled = true;
  resultsEl.innerHTML = "";

  try {
    setStatus(`JSON: парсинг ${instanceCount} копий...`, "running");
    const jsonParse = await runParseBenchmark({
      format: "json",
      instanceCount,
    });

    setStatus(`SKEL: парсинг ${instanceCount} копий...`, "running");
    const skelParse = await runParseBenchmark({
      format: "skel",
      instanceCount,
    });

    setStatus("JSON: playback...", "running");
    const jsonPlayback = await runPlaybackBenchmark({
      canvas,
      format: "json",
      instanceCount,
      animationName,
      durationSec: playbackDuration,
    });

    setStatus("SKEL: playback...", "running");
    const skelPlayback = await runPlaybackBenchmark({
      canvas,
      format: "skel",
      instanceCount,
      animationName,
      durationSec: playbackDuration,
    });

    const json: BenchmarkSuiteResult = {
      parse: jsonParse,
      playback: jsonPlayback,
    };
    const skel: BenchmarkSuiteResult = {
      parse: skelParse,
      playback: skelPlayback,
    };

    renderResults(json, skel);
    setStatus("Benchmark завершён", "done");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown benchmark error";
    setStatus(message, "error");
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener("click", () => {
  void runFullBenchmark();
});

setStatus("Готов к запуску", "idle");
