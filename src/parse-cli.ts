import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFrameBudgetMs } from "./shared/parseBenchmark";
import {
  loadSpineAssetsFromDisk,
  runParseBenchmarkNode,
} from "./shared/parseBenchmarkNode";
import {
  formatBytes,
  formatMs,
} from "./shared/metrics";
import { spineAssetsConfig } from "./shared/spineConfig";
import type { ParseBenchmarkResult } from "./types";

const INSTANCE_COUNT = Number(process.env.INSTANCES ?? 4);
const ASSETS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);

function printParseResult(result: ParseBenchmarkResult): void {
  console.log(`\n=== ${result.format.toUpperCase()} ===`);
  console.log(`Skeletons:              ${result.skeletonCount}`);
  console.log(`File size (all):        ${formatBytes(result.fileSizeBytes)}`);
  console.log(`Copies per skeleton:    ${result.instanceCount}`);
  console.log(
    `Parses total:           ${result.skeletonCount * result.instanceCount}`,
  );
  console.log(`Total parse time:       ${formatMs(result.totalParseMs)}`);
  console.log(`Average per parse:      ${formatMs(result.avgParseMs)}`);
  console.log(`Min / Max per parse:    ${formatMs(result.minParseMs)} / ${formatMs(result.maxParseMs)}`);
  console.log(
    `Estimated dropped frames: ${result.droppedFramesDuringParse} (budget ${formatMs(getFrameBudgetMs())})`,
  );
  console.log(`Longest blocking gap:   ${formatMs(result.longestFrameGapMs)}`);
}

function printComparison(json: ParseBenchmarkResult, skel: ParseBenchmarkResult): void {
  const parseSpeedup = json.totalParseMs / skel.totalParseMs;
  const sizeReduction =
    ((json.fileSizeBytes - skel.fileSizeBytes) / json.fileSizeBytes) * 100;

  console.log("\n=== COMPARISON ===");
  console.log(`SKEL is ${parseSpeedup.toFixed(2)}x faster to parse`);
  console.log(`SKEL files are ${sizeReduction.toFixed(1)}% smaller`);
  console.log(
    `SKEL saves ${formatMs(json.totalParseMs - skel.totalParseMs)} on ${json.skeletonCount} skeletons × ${INSTANCE_COUNT} copies`,
  );
}

async function main(): Promise<void> {
  console.log("Spine parse benchmark (Node.js)");
  console.log(`Assets: ${ASSETS_DIR}`);
  console.log(`Skeletons: ${spineAssetsConfig.skeletons.length}`);
  console.log(`Copies per skeleton: ${INSTANCE_COUNT}`);

  const jsonAssets = await loadSpineAssetsFromDisk("json", ASSETS_DIR);
  const skelAssets = await loadSpineAssetsFromDisk("skel", ASSETS_DIR);

  const jsonResult = runParseBenchmarkNode(
    jsonAssets,
    "json",
    INSTANCE_COUNT,
  );
  const skelResult = runParseBenchmarkNode(
    skelAssets,
    "skel",
    INSTANCE_COUNT,
  );

  printParseResult(jsonResult);
  printParseResult(skelResult);
  printComparison(jsonResult, skelResult);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
