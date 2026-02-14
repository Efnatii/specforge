export class FindService {
  constructor() {
    this.index = { entries: [] };
    this.results = [];
    this.activeIndex = -1;
  }

  setIndex(index) {
    this.index = index || { entries: [] };
    this.results = [];
    this.activeIndex = -1;
  }

  query({ needle, matchCase = false, wholeCell = false, useRegex = false, sheetName = null }) {
    const textNeedle = String(needle || "");
    if (!textNeedle) {
      this.results = [];
      this.activeIndex = -1;
      return [];
    }

    let regex = null;
    if (useRegex) {
      regex = new RegExp(textNeedle, matchCase ? "g" : "gi");
    }

    this.results = [];
    for (const entry of this.index.entries || []) {
      if (sheetName && entry.sheetName !== sheetName) {
        continue;
      }

      const hay = matchCase ? entry.text : entry.text.toLowerCase();
      const n = matchCase ? textNeedle : textNeedle.toLowerCase();

      let ok = false;
      if (regex) {
        ok = regex.test(entry.text);
      } else if (wholeCell) {
        ok = hay === n;
      } else {
        ok = hay.includes(n);
      }

      if (ok) {
        this.results.push(entry);
      }
    }

    this.activeIndex = this.results.length ? 0 : -1;
    return this.results;
  }

  getActiveResult() {
    if (this.activeIndex < 0 || this.activeIndex >= this.results.length) {
      return null;
    }
    return this.results[this.activeIndex];
  }

  next() {
    if (!this.results.length) {
      return null;
    }
    this.activeIndex = (this.activeIndex + 1) % this.results.length;
    return this.getActiveResult();
  }

  prev() {
    if (!this.results.length) {
      return null;
    }
    this.activeIndex = (this.activeIndex - 1 + this.results.length) % this.results.length;
    return this.getActiveResult();
  }

  setActiveResult(idx) {
    if (idx < 0 || idx >= this.results.length) {
      return null;
    }
    this.activeIndex = idx;
    return this.getActiveResult();
  }
}
