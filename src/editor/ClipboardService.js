import { PasteParser } from "./PasteParser.js";
import { RangeOps } from "./RangeOps.js";

export class ClipboardService {
  constructor({ toast, pasteParser = new PasteParser() } = {}) {
    this.toast = toast;
    this.pasteParser = pasteParser;
    this.provider = null;
    this.rootEl = null;
    this.handlers = null;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  bindToRoot(rootEl) {
    this.unbind();
    this.rootEl = rootEl;
    this.handlers = {
      copy: (event) => this.onCopy(event, { cut: false }),
      cut: (event) => this.onCopy(event, { cut: true }),
      paste: (event) => this.onPaste(event)
    };

    rootEl.addEventListener("copy", this.handlers.copy);
    rootEl.addEventListener("cut", this.handlers.cut);
    rootEl.addEventListener("paste", this.handlers.paste);
  }

  unbind() {
    if (!this.rootEl || !this.handlers) {
      return;
    }

    this.rootEl.removeEventListener("copy", this.handlers.copy);
    this.rootEl.removeEventListener("cut", this.handlers.cut);
    this.rootEl.removeEventListener("paste", this.handlers.paste);
    this.rootEl = null;
    this.handlers = null;
  }

  async copyViaApi() {
    if (!this.provider?.getSelectionMatrix) {
      return false;
    }

    const matrix = this.provider.getSelectionMatrix();
    if (!matrix?.length) {
      return false;
    }

    const tsv = RangeOps.tsvEncode(matrix);
    if (!tsv) {
      return false;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tsv);
        return true;
      }
    } catch {
      // fallback below
    }

    const fallback = document.createElement("textarea");
    fallback.value = tsv;
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    fallback.style.pointerEvents = "none";
    document.body.appendChild(fallback);
    fallback.focus();
    fallback.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(fallback);
    return ok;
  }

  onCopy(event, { cut = false } = {}) {
    if (!this.provider?.getSelectionMatrix) {
      return;
    }

    const matrix = this.provider.getSelectionMatrix();
    if (!matrix?.length) {
      return;
    }

    const tsv = RangeOps.tsvEncode(matrix);
    event.preventDefault();
    event.clipboardData?.setData("text/plain", tsv);

    if (cut) {
      this.provider.clearSelectionValues?.();
    }
  }

  onPaste(event) {
    if (!this.provider?.applyMatrixAtTarget) {
      return;
    }

    const text = event.clipboardData?.getData("text/plain");
    if (!text) {
      return;
    }

    event.preventDefault();
    let parsed;
    try {
      parsed = this.pasteParser.parseText(text);
    } catch (error) {
      this.toast?.show(error.message, "error");
      return;
    }

    Promise.resolve(this.provider.applyMatrixAtTarget(parsed.matrix)).catch((error) => {
      this.toast?.show(error.message || "Paste failed", "error");
    });
  }
}
