import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ASSETS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/assets",
);
const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/assets-gzip",
);

async function gzipAssets(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);

  if (files.length === 0) {
    console.log(`No files found in ${ASSETS_DIR}`);
    return;
  }

  console.log(`Source: ${ASSETS_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  let totalRaw = 0;
  let totalGzip = 0;

  for (const fileName of files.sort()) {
    const sourcePath = path.join(ASSETS_DIR, fileName);
    const raw = await fs.readFile(sourcePath);
    const gz = zlib.gzipSync(raw, { level: 9 });

    await fs.writeFile(path.join(OUTPUT_DIR, `${fileName}.gz`), gz);

    console.log(fileName, "raw:", raw.length, "gzip:", gz.length);

    totalRaw += raw.length;
    totalGzip += gz.length;
  }

  console.log("\n--- total ---");
  console.log("raw:", totalRaw, "gzip:", totalGzip);
}

gzipAssets().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
