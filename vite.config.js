import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

function copyAssetsPlugin() {
  return {
    name: "copy-assets",
    closeBundle() {
      const sourceDir = resolve(ROOT_DIR, "assets");
      if (!existsSync(sourceDir)) {
        return;
      }

      const destinationDir = resolve(ROOT_DIR, "dist/assets");
      mkdirSync(destinationDir, { recursive: true });
      cpSync(sourceDir, destinationDir, { recursive: true });
    }
  };
}

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : resolveBase(),
  plugins: [copyAssetsPlugin(), noJekyllPlugin()]
}));

function resolveBase() {
  const explicit = process.env.VITE_BASE_PATH;
  if (explicit) {
    return explicit;
  }

  const repo = process.env.GITHUB_REPOSITORY || "";
  const repoName = repo.split("/")[1] || "";
  if (repoName) {
    return repoName.endsWith(".github.io") ? "/" : `/${repoName}/`;
  }

  const packageName = process.env.npm_package_name || "specforge";
  return packageName.endsWith(".github.io") ? "/" : `/${packageName}/`;
}

function noJekyllPlugin() {
  return {
    name: "no-jekyll",
    closeBundle() {
      const distDir = resolve(ROOT_DIR, "dist");
      mkdirSync(distDir, { recursive: true });
      const marker = resolve(ROOT_DIR, "dist/.nojekyll");
      const builtIndex = resolve(ROOT_DIR, "dist/index.html");
      if (existsSync(builtIndex)) {
        cpSync(builtIndex, resolve(ROOT_DIR, "dist/404.html"));
      }
      writeFileSync(marker, "");
    }
  };
}
