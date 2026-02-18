export class ClipboardModule {
  constructor({ windowRef, documentRef }) {
    if (!windowRef) throw new Error("ClipboardModule requires windowRef");
    if (!documentRef) throw new Error("ClipboardModule requires documentRef");
    this._window = windowRef;
    this._document = documentRef;
  }

  _copyTextLegacy(text) {
    if (typeof this._document.execCommand !== "function") {
      throw new Error("copy legacy API unavailable");
    }
    const ta = this._document.createElement("textarea");
    ta.value = String(text ?? "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    this._document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let copied = false;
    try {
      copied = Boolean(this._document.execCommand("copy"));
    } finally {
      this._document.body.removeChild(ta);
    }
    if (!copied) throw new Error("copy legacy API failed");
  }

  async copyText(text) {
    const value = String(text ?? "");
    try {
      this._copyTextLegacy(value);
      return;
    } catch {}
    if (this._window.navigator?.clipboard?.writeText) {
      await this._window.navigator.clipboard.writeText(value);
      return;
    }
    throw new Error("copy API unavailable");
  }
}
