import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { listFilesRecursive, toAssetPath } from "./shared/utils";

const ASSETS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);
const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/assets-gzip",
);

async function gzipAssets(): Promise<void> {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await listFilesRecursive(ASSETS_DIR)).sort((left, right) =>
    toAssetPath(ASSETS_DIR, left).localeCompare(toAssetPath(ASSETS_DIR, right)),
  );

  if (files.length === 0) {
    console.log(`No files found in ${ASSETS_DIR}`);
    return;
  }

  console.log(`Source: ${ASSETS_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  let totalRaw = 0;
  let totalGzip = 0;
  const folderTotals = new Map<string, { raw: number; gzip: number; files: number }>();

  for (const sourcePath of files) {
    const relativePath = toAssetPath(ASSETS_DIR, sourcePath);
    const raw = await fs.readFile(sourcePath);
    const gz = zlib.gzipSync(raw, { level: 9 });
    const outputPath = path.join(OUTPUT_DIR, `${relativePath}.gz`);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, gz);

    console.log(relativePath, "raw:", raw.length, "gzip:", gz.length);

    totalRaw += raw.length;
    totalGzip += gz.length;

    const folder = relativePath.includes("/")
      ? relativePath.slice(0, relativePath.indexOf("/"))
      : ".";
    const folderTotal = folderTotals.get(folder) ?? { raw: 0, gzip: 0, files: 0 };
    folderTotal.raw += raw.length;
    folderTotal.gzip += gz.length;
    folderTotal.files += 1;
    folderTotals.set(folder, folderTotal);
  }

  console.log("\n--- by folder ---");
  for (const [folder, totals] of folderTotals) {
    console.log(
      folder,
      "files:",
      totals.files,
      "raw:",
      totals.raw,
      "gzip:",
      totals.gzip,
    );
  }

  console.log("\n--- total ---");
  console.log("files:", files.length, "raw:", totalRaw, "gzip:", totalGzip);
}

gzipAssets().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
