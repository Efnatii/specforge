import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const indexPath = resolve(distDir, "index.html");

if (!existsSync(indexPath)) {
  fail("dist/index.html does not exist");
}

const html = readFileSync(indexPath, "utf8");
if (!html.trim()) {
  fail("dist/index.html is empty");
}

if (html.includes('/src/main.js') || html.includes('src="/src/')) {
  fail("dist/index.html still points to source entry (/src/main.js)");
}

const expectedBase = resolveExpectedBase();
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
const assetRefs = refs.filter((x) => x.includes('/assets/'));

if (!assetRefs.length) {
  fail("No assets references found in dist/index.html");
}

for (const ref of assetRefs) {
  if (!ref.startsWith(expectedBase)) {
    fail(`Asset ref '${ref}' does not start with expected base '${expectedBase}'`);
  }

  const filePart = ref.slice(expectedBase.length).replace(/^\//, "");
  const fsPath = resolve(distDir, filePart);
  if (!existsSync(fsPath)) {
    fail(`Referenced asset file not found: ${filePart}`);
  }
}

console.log("[smoke] pages build looks valid");

function resolveExpectedBase() {
  const explicit = process.env.VITE_BASE_PATH;
  if (explicit) {
    return ensureSlash(explicit);
  }

  const repo = process.env.GITHUB_REPOSITORY || "";
  const repoName = repo.split("/")[1] || "";
  if (repoName) {
    return repoName.endsWith(".github.io") ? "/" : `/${repoName}/`;
  }

  const pkg = process.env.npm_package_name || "specforge";
  return pkg.endsWith(".github.io") ? "/" : `/${pkg}/`;
}

function ensureSlash(base) {
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }
  if (!base.endsWith("/")) {
    base = `${base}/`;
  }
  return base;
}

function fail(message) {
  console.error(`[smoke] ${message}`);
  process.exit(1);
}
