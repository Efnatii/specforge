export class ClipboardModule {
  constructor({ windowRef, documentRef }) {
    if (!windowRef) throw new Error("ClipboardModule requires windowRef");
    if (!documentRef) throw new Error("ClipboardModule requires documentRef");
    this._window = windowRef;
    this._document = documentRef;
  }

  async copyText(text) {
    try {
      if (this._window.navigator?.clipboard?.writeText) {
        await this._window.navigator.clipboard.writeText(text);
        return;
      }
    } catch {}

    const ta = this._document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    this._document.body.appendChild(ta);
    ta.select();
    this._document.execCommand("copy");
    this._document.body.removeChild(ta);
  }
}
