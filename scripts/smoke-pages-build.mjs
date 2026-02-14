import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const indexPath = resolve(distDir, "index.html");

if (!existsSync(indexPath)) {
  fail("dist/index.html не найден");
}

const html = readFileSync(indexPath, "utf8");
if (!html.trim()) {
  fail("dist/index.html пустой");
}

const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
if (refs.some((ref) => ref.includes("/src/") || ref.includes("./src/"))) {
  fail("dist/index.html содержит ссылки на src (dev-индекс)");
}

const assetRefs = refs.filter((ref) => /\.(?:js|css)(?:\?|#|$)/.test(ref));

if (!assetRefs.length) {
  fail("в dist/index.html не найдены js/css ссылки");
}

for (const ref of assetRefs) {
  const fsPath = resolveRefToDisk(ref);
  if (!existsSync(fsPath)) {
    fail(`ссылка указывает на отсутствующий файл: ${ref}`);
  }
}

const expectedBase = resolveExpectedBase();
if (expectedBase !== "/" && !html.includes(expectedBase)) {
  fail(`не найден ожидаемый base '${expectedBase}' в dist/index.html`);
}

console.log("[smoke] OK: pages build валиден");

function resolveRefToDisk(ref) {
  const clean = ref.split("#")[0].split("?")[0];
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    fail(`внешняя ссылка не поддерживается smoke-check: ${ref}`);
  }

  if (clean.startsWith("/")) {
    const expectedBase = resolveExpectedBase();
    if (!clean.startsWith(expectedBase)) {
      fail(`путь '${clean}' не начинается с ожидаемого base '${expectedBase}'`);
    }
    const rel = clean.slice(expectedBase.length).replace(/^\/+/, "");
    return resolve(distDir, rel);
  }

  return resolve(distDir, clean.replace(/^\.\/+/, ""));
}

function resolveExpectedBase() {
  const explicit = process.env.VITE_BASE_PATH;
  if (explicit) {
    return normalizeBase(explicit);
  }

  const repo = process.env.GITHUB_REPOSITORY || "";
  const repoName = repo.split("/")[1] || "";
  if (repoName) {
    return repoName.endsWith(".github.io") ? "/" : `/${repoName}/`;
  }

  const pkg = process.env.npm_package_name || "specforge";
  return pkg.endsWith(".github.io") ? "/" : `/${pkg}/`;
}

function normalizeBase(base) {
  let out = base;
  if (!out.startsWith("/")) {
    out = `/${out}`;
  }
  if (!out.endsWith("/")) {
    out = `${out}/`;
  }
  return out;
}

function fail(message) {
  console.error(`[smoke] ${message}`);
  process.exit(1);
}
