import { cpSync, existsSync, mkdirSync } from "node:fs";
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

export default defineConfig({
  base: "./",
  plugins: [copyAssetsPlugin()]
});
