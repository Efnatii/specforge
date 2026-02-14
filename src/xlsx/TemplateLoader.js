const XLSX_SIGNATURE = [0x50, 0x4b];

export class TemplateLoader {
  constructor({ maxSizeBytes = 40 * 1024 * 1024 } = {}) {
    this.maxSizeBytes = maxSizeBytes;
  }

  async loadFromAsset(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Template asset load failed (${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    this.validateXlsx(buffer);

    const guessedName = this.extractNameFromUrl(url);
    return {
      buffer,
      meta: {
        source: "asset",
        name: guessedName
      }
    };
  }

  async loadFromFile(file) {
    if (!file) {
      throw new Error("No file selected");
    }

    const buffer = await file.arrayBuffer();
    this.validateXlsx(buffer);

    return {
      buffer,
      meta: {
        source: "file",
        name: file.name || "local.xlsx"
      }
    };
  }

  validateXlsx(buffer) {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error("Invalid file payload");
    }

    if (buffer.byteLength === 0) {
      throw new Error("XLSX file is empty");
    }

    if (buffer.byteLength > this.maxSizeBytes) {
      throw new Error(`XLSX is too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB)`);
    }

    const bytes = new Uint8Array(buffer, 0, 2);
    if (bytes[0] !== XLSX_SIGNATURE[0] || bytes[1] !== XLSX_SIGNATURE[1]) {
      throw new Error("File is not a valid XLSX zip container");
    }
  }

  extractNameFromUrl(url) {
    try {
      const resolved = new URL(url, window.location.href);
      const parts = resolved.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || "template.xlsx";
    } catch {
      return "template.xlsx";
    }
  }
}
