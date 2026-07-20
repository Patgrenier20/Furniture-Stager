import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
process.env.PORT = process.env.PORT ?? "8080";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: artifactDir,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["run", "build"]);
run("node", ["--enable-source-maps", "./dist/index.mjs"]);
