// Turns the built app into the exact folder Vercel deploys (its "Build Output API"):
//
//   .vercel/output/
//     config.json                 routing + security headers for the CDN
//     static/                     the built React app, served from Vercel's CDN
//     functions/api.func/         the Express API, bundled into one file
//
// Run after `npm run build` (which builds client/dist). See README for the why.
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { HSTS, SECURITY_HEADERS } from "../src/securityHeaders";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = `${root}.vercel/output`;
const clientDist = `${root}client/dist`;
const funcDir = `${out}/functions/api.func`;

if (!existsSync(`${clientDist}/index.html`)) {
  throw new Error("client/dist is missing. Run `npm run build` first.");
}

// Start clean so files from an older build can't linger in the deployment.
rmSync(out, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });

// 1. Static files: the built React app, as-is.
cpSync(clientDist, `${out}/static`, { recursive: true });

// 2. The API: bundle server/src/vercel.ts and everything it imports (Express,
//    pg, zod, our shared schema) into a single ES module.
await build({
  entryPoints: [`${root}server/src/vercel.ts`],
  outfile: `${funcDir}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  // pg only loads its optional native bindings if you ask for them; we don't.
  external: ["pg-native"],
  // Express and pg are CommonJS and call require() for Node built-ins.
  // ES modules don't have require, so give the bundle one.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  legalComments: "none",
  logLevel: "warning",
});

writeFileSync(
  `${funcDir}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs24.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      maxDuration: 10,
    },
    null,
    2,
  ),
);

// 3. Routing. Order matters:
//    - add security headers to every non-API response (the API sets its own),
//    - serve any matching static file,
//    - send /api/* to the function (it still sees the original path),
//    - anything else falls back to index.html.
const config = {
  version: 3,
  routes: [
    {
      src: "^/(?!api/).*",
      headers: { ...SECURITY_HEADERS, "Strict-Transport-Security": HSTS },
      continue: true,
    },
    // Vite fingerprints asset filenames, so they can be cached forever.
    {
      src: "^/assets/.*",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    { handle: "filesystem" },
    { src: "^/api/.*", dest: "/api" },
    { src: "^/.*", dest: "/index.html" },
  ],
};

writeFileSync(`${out}/config.json`, JSON.stringify(config, null, 2));

console.log("Vercel build output written to .vercel/output");
