export class TemplateBufferStore {
  constructor(idbStore) {
    this.idbStore = idbStore;
    this.buffer = null;
    this.meta = null;
  }

  async setBaselineBuffer(arrayBuffer, meta) {
    const cloned = await this.normalizeBuffer(arrayBuffer);
    this.buffer = cloned;
    this.meta = { ...meta };

    await this.idbStore.put("baselineTemplateBuffer", cloned.slice(0));
    await this.idbStore.put("baselineTemplateMeta", this.meta);
  }

  async restore() {
    const [bufferRaw, meta] = await Promise.all([
      this.idbStore.get("baselineTemplateBuffer"),
      this.idbStore.get("baselineTemplateMeta")
    ]);

    if (!bufferRaw) {
      this.buffer = null;
      this.meta = null;
      return null;
    }

    this.buffer = await this.normalizeBuffer(bufferRaw);
    this.meta = meta || null;

    return {
      buffer: this.buffer.slice(0),
      meta: this.meta ? { ...this.meta } : null
    };
  }

  getBaselineBuffer() {
    if (!this.buffer) {
      return null;
    }

    return {
      buffer: this.buffer.slice(0),
      meta: this.meta ? { ...this.meta } : null
    };
  }

  async clear() {
    this.buffer = null;
    this.meta = null;
    await this.idbStore.delete("baselineTemplateBuffer");
    await this.idbStore.delete("baselineTemplateMeta");
  }

  async normalizeBuffer(value) {
    if (value instanceof ArrayBuffer) {
      return value;
    }

    if (value instanceof Uint8Array) {
      return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    }

    if (value instanceof Blob) {
      return value.arrayBuffer();
    }

    throw new Error("Unknown baseline buffer format");
  }
}
