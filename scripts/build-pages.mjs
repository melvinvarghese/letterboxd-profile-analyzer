import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "letterboxd-profile-analyzer";
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_BASE_PATH: base,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
if (result.status !== 0) process.exit(result.status || 1);
writeFileSync("out/.nojekyll", "");
writeFileSync(
  "out/DEPLOYMENT.txt",
  `Frame by Frame 2.0\nVerified static export. Upload these files at the root of the letterboxd-profile-analyzer repository, or serve them at /${base}/.\nNo API key is embedded. Core analytics run locally in the browser.\n`,
);

const verify = spawnSync(process.execPath, ["scripts/verify-static.mjs"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: base },
});
if (verify.status !== 0) process.exit(verify.status || 1);
