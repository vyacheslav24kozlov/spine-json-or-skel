import { runParseBenchmark } from "./shared/parseBenchmark";
import { runPlaybackBenchmark } from "./shared/playbackBenchmark";
import {
  formatBytes,
  formatFps,
  formatMs,
} from "./shared/metrics";
import {
  formatAnimationGroupLabel,
  spineAssetsConfig,
} from "./shared/spineConfig";
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
const animationGroupSelect =
  document.querySelector<HTMLSelectElement>("#animation-group")!;
const playbackDurationInput =
  document.querySelector<HTMLInputElement>("#playback-duration")!;
const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;

function populateAnimationGroups(): void {
  animationGroupSelect.replaceChildren();
  for (const group of spineAssetsConfig.animationGroups) {
    if (group.entries.length === 0) {
      continue;
    }
    const option = document.createElement("option");
    option.value = String(group.id);
    option.textContent = formatAnimationGroupLabel(group);
    animationGroupSelect.append(option);
  }
}

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
    ["Скелетов", String(result.skeletonCount)],
    ["Размер всех файлов", formatBytes(result.fileSizeBytes)],
    ["Копий на скелет", String(result.instanceCount)],
    ["Всего парсингов", String(result.skeletonCount * result.instanceCount)],
    ["Всего", formatMs(result.totalParseMs)],
    ["Среднее на парсинг", formatMs(result.avgParseMs)],
    ["Min / Max", `${formatMs(result.minParseMs)} / ${formatMs(result.maxParseMs)}`],
    ["Просадки при парсинге", String(result.droppedFramesDuringParse)],
    ["Макс. блокировка кадра", formatMs(result.longestFrameGapMs)],
  ]);
}

function renderPlaybackCard(result: PlaybackBenchmarkResult): string {
  return renderMetricCard(`Playback — ${result.format.toUpperCase()}`, [
    ["Группа", result.animationName],
    ["Скелетов", String(result.skeletonCount)],
    ["Инстансов", String(result.instanceCount)],
    ["Средний FPS", formatFps(result.avgFps)],
    ["Минимальный FPS", formatFps(result.minFps)],
    ["Кадров", String(result.totalFrames)],
    ["Просадки (>150% budget)", String(result.droppedFrames)],
    ["P95 frame time", formatMs(result.frameTimeP95Ms)],
  ]);
}

function renderInstanceCreateCard(result: InstanceCreateBenchmarkResult): string {
  return renderMetricCard(`Создание инстансов — ${result.format.toUpperCase()}`, [
    ["Группа", result.animationName],
    ["Скелетов", String(result.skeletonCount)],
    ["Инстансов", String(result.instanceCount)],
    ["Всего", formatMs(result.totalCreateMs)],
    ["Среднее на инстанс", formatMs(result.avgCreateMs)],
    ["Min / Max", `${formatMs(result.minCreateMs)} / ${formatMs(result.maxCreateMs)}`],
    ["Просадки при создании", String(result.droppedFramesDuringCreate)],
    ["Макс. блокировка кадра", formatMs(result.longestFrameGapMs)],
  ]);
}

function renderComparisonBlock(
  title: string,
  className: string,
  metrics: Array<[string, string]>,
): string {
  const rows = metrics
    .map(
      ([label, value]) =>
        `<dt>${label}</dt><dd>${value}</dd>`,
    )
    .join("");

  return `
    <section class="comparison ${className}">
      <h3>${title}</h3>
      <dl>${rows}</dl>
    </section>
  `;
}

function renderParseComparison(
  json: ParseBenchmarkResult,
  skel: ParseBenchmarkResult,
): string {
  const parseSpeedup = json.totalParseMs / skel.totalParseMs;
  const sizeReduction =
    ((json.fileSizeBytes - skel.fileSizeBytes) / json.fileSizeBytes) * 100;

  return renderComparisonBlock("Сравнение парсинга", "parse-comparison", [
    ["SKEL быстрее парсится", `${parseSpeedup.toFixed(2)}x`],
    ["SKEL меньше по размеру", `${sizeReduction.toFixed(1)}%`],
    ["Экономия времени парсинга", formatMs(json.totalParseMs - skel.totalParseMs)],
    ["Разница среднего на копию", `${formatMs(json.avgParseMs - skel.avgParseMs)} (JSON − SKEL)`],
  ]);
}

function renderInstanceCreateComparison(
  json: InstanceCreateBenchmarkResult,
  skel: InstanceCreateBenchmarkResult,
): string {
  const createSpeedup = json.totalCreateMs / skel.totalCreateMs;

  return renderComparisonBlock(
    "Сравнение создания инстансов",
    "instance-create-comparison",
    [
      ["SKEL быстрее создаёт инстансы", `${createSpeedup.toFixed(2)}x`],
      ["Экономия времени создания", formatMs(json.totalCreateMs - skel.totalCreateMs)],
      [
        "Разница среднего на инстанс",
        `${formatMs(json.avgCreateMs - skel.avgCreateMs)} (JSON − SKEL)`,
      ],
    ],
  );
}

function renderPlaybackComparison(
  json: PlaybackBenchmarkResult,
  skel: PlaybackBenchmarkResult,
): string {
  const avgFpsDelta = skel.avgFps - json.avgFps;
  const minFpsDelta = skel.minFps - json.minFps;
  const p95FrameTimeDelta = json.frameTimeP95Ms - skel.frameTimeP95Ms;

  return renderComparisonBlock("Сравнение playback", "playback-comparison", [
    [
      "Разница среднего FPS",
      `${avgFpsDelta >= 0 ? "+" : ""}${avgFpsDelta.toFixed(1)} FPS (SKEL vs JSON)`,
    ],
    [
      "Разница минимального FPS",
      `${minFpsDelta >= 0 ? "+" : ""}${minFpsDelta.toFixed(1)} FPS (SKEL vs JSON)`,
    ],
    [
      "Разница P95 frame time",
      `${formatMs(p95FrameTimeDelta)} (JSON − SKEL)`,
    ],
  ]);
}

function renderResults(
  json: BenchmarkSuiteResult,
  skel: BenchmarkSuiteResult,
): void {
  resultsEl.innerHTML = [
    renderParseCard(json.parse),
    renderParseCard(skel.parse),
    renderParseComparison(json.parse, skel.parse),
    renderInstanceCreateCard(json.playback.instanceCreate),
    renderInstanceCreateCard(skel.playback.instanceCreate),
    renderInstanceCreateComparison(
      json.playback.instanceCreate,
      skel.playback.instanceCreate,
    ),
    renderPlaybackCard(json.playback),
    renderPlaybackCard(skel.playback),
    renderPlaybackComparison(json.playback, skel.playback),
  ].join("");
}

async function runFullBenchmark(): Promise<void> {
  const instanceCount = Number(instanceCountInput.value);
  const animationGroupId = Number(animationGroupSelect.value);
  const playbackDuration = Number(playbackDurationInput.value);
  const skeletonCount = spineAssetsConfig.skeletons.length;

  runButton.disabled = true;
  resultsEl.innerHTML = "";

  try {
    setStatus(`JSON: парсинг ${skeletonCount} скелетов...`, "running");
    const jsonParse = await runParseBenchmark({
      format: "json",
      instanceCount,
      onProgress: (done, total, skeletonId) => {
        setStatus(
          `JSON: парсинг ${skeletonId} (${done}/${total})...`,
          "running",
        );
      },
    });

    setStatus(`SKEL: парсинг ${skeletonCount} скелетов...`, "running");
    const skelParse = await runParseBenchmark({
      format: "skel",
      instanceCount,
      onProgress: (done, total, skeletonId) => {
        setStatus(
          `SKEL: парсинг ${skeletonId} (${done}/${total})...`,
          "running",
        );
      },
    });

    setStatus("JSON: playback...", "running");
    const jsonPlayback = await runPlaybackBenchmark({
      canvas,
      format: "json",
      instanceCount,
      animationGroupId,
      durationSec: playbackDuration,
    });

    setStatus("SKEL: playback...", "running");
    const skelPlayback = await runPlaybackBenchmark({
      canvas,
      format: "skel",
      instanceCount,
      animationGroupId,
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

populateAnimationGroups();
setStatus(
  `Готов к запуску · ${spineAssetsConfig.skeletons.length} скелетов`,
  "idle",
);
