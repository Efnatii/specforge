export class AppFormattingModule {
  constructor({ num }) {
    if (typeof num !== "function") throw new Error("AppFormattingModule requires num()");
    this._num = num;
  }

  money(v) {
    const value = this._num(v);
    return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ₽`;
  }

  escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
}
