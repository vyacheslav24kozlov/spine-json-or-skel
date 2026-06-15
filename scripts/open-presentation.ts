import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "docs", "spine-parse-benchmark-presentation.html");

if (process.platform === "win32") {
  execFileSync("cmd.exe", ["/c", "start", "", htmlPath], {
    stdio: "ignore",
    windowsHide: true,
  });
} else if (process.platform === "darwin") {
  execFileSync("open", [htmlPath], { stdio: "ignore" });
} else {
  execFileSync("xdg-open", [htmlPath], { stdio: "ignore" });
}
