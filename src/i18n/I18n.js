export class I18n {
  constructor(dict = {}) {
    this.dict = dict;
  }

  t(key, params = {}) {
    const raw = this.resolve(key);
    const value = typeof raw === "string" ? raw : key;
    return value.replace(/\{(\w+)\}/g, (_, name) => {
      if (params[name] === undefined || params[name] === null) {
        return "";
      }
      return String(params[name]);
    });
  }

  resolve(key) {
    const parts = String(key || "").split(".");
    let node = this.dict;
    for (const part of parts) {
      if (!node || typeof node !== "object" || !(part in node)) {
        return null;
      }
      node = node[part];
    }
    return node;
  }
}
