const DEFAULT_SETTINGS = Object.freeze({
  orderNumber: "0091-0821",
  requestNumber: "0254",
  changeDate: "2026-02-15",
  version: "",
  vatRate: 0.22,
  totalMode: "withoutDiscount",
});

export class ProjectStateModule {
  constructor({ createId }) {
    if (typeof createId !== "function") throw new Error("ProjectStateModule requires createId()");
    this._createId = createId;
  }

  num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  round2(value) {
    return Math.round((this.num(value) + Number.EPSILON) * 100) / 100;
  }

  ceil1(value) {
    return Math.ceil(this.num(value));
  }

  normalizeCellValue(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const n = Number(value);
      return Number.isFinite(n) && value.trim() !== "" ? n : value;
    }
    return value;
  }

  keepAbbr(value) {
    return String(value ?? "").trim();
  }

  deriveAbbr(name) {
    const src = String(name || "").replace(/\s+/g, " ").trim();
    if (!src) return "СБР";

    const tokens = src.split(" ").filter(Boolean);
    if (!tokens.length) return "СБР";

    let idx = 0;
    let initials = "";
    while (idx < tokens.length && /^[\p{L}]+$/u.test(tokens[idx])) {
      initials += tokens[idx][0].toUpperCase();
      idx += 1;
    }

    if (initials && idx < tokens.length) {
      return `${initials}${tokens.slice(idx).join(" ")}`.trim();
    }
    if (initials) return initials;
    if (tokens.length === 1) return tokens[0];
    return src;
  }

  pctToDec(value) {
    return this.num(value) / 100;
  }

  normalizePercentDecimal(value, fallback = 0) {
    const n = this.num(value, fallback);
    const abs = Math.abs(n);
    return abs > 1 && abs <= 100 ? n / 100 : n;
  }

  decToPct(value) {
    return this.round2(this.num(value) * 100);
  }

  createPosition() {
    return {
      id: this._createId(),
      schematic: "",
      name: "",
      manufacturer: "",
      article: "",
      qty: 1,
      unit: "шт",
      priceCatalogVatMarkup: 0,
      markup: 0,
      discount: 0,
      supplier: "",
      note: "",
    };
  }

  createAssembly(index = 1) {
    const fullName = `Новая сборка ${index}`;
    return {
      id: this._createId(),
      fullName,
      abbreviation: this.deriveAbbr(fullName),
      abbrManual: false,
      separateConsumables: false,
      main: [],
      consumable: [],
      manualConsNoDisc: 0,
      manualConsDisc: 0,
      labor: {
        devCoeff: 1.25,
        devHours: 0,
        devRate: 0,
        assmCoeff: 1.25,
        assmHours: 0,
        assmRate: 0,
        profitCoeff: 0.3,
      },
    };
  }

  createDefaultState() {
    return {
      settings: {
        orderNumber: DEFAULT_SETTINGS.orderNumber,
        requestNumber: DEFAULT_SETTINGS.requestNumber,
        changeDate: DEFAULT_SETTINGS.changeDate,
        version: DEFAULT_SETTINGS.version,
        vatRate: DEFAULT_SETTINGS.vatRate,
        totalMode: DEFAULT_SETTINGS.totalMode,
      },
      assemblies: [],
      hasProjectConsumables: false,
      projectConsumables: [],
    };
  }

  normalizeState(raw) {
    const base = this.createDefaultState();
    const settingsRaw = raw?.settings || {};

    return {
      settings: {
        orderNumber: String(settingsRaw.orderNumber || base.settings.orderNumber),
        requestNumber: String(settingsRaw.requestNumber || base.settings.requestNumber),
        changeDate: String(settingsRaw.changeDate || base.settings.changeDate),
        version: String(settingsRaw.version || ""),
        vatRate: this._normVat(settingsRaw.vatRate, base.settings.vatRate),
        totalMode: settingsRaw.totalMode === "withDiscount" ? "withDiscount" : "withoutDiscount",
      },
      assemblies: Array.isArray(raw?.assemblies)
        ? raw.assemblies.map((assembly, idx) => this._normAssembly(assembly, idx + 1))
        : [],
      hasProjectConsumables: Boolean(raw?.hasProjectConsumables),
      projectConsumables: Array.isArray(raw?.projectConsumables)
        ? raw.projectConsumables.map((position) => this._normPosition(position))
        : [],
    };
  }

  normalizeSheetOverrides(raw, normalizeValue = (value) => value) {
    if (!raw || typeof raw !== "object") return {};

    const out = {};
    for (const [sheetId, cells] of Object.entries(raw)) {
      if (!cells || typeof cells !== "object") continue;

      const map = {};
      for (const [key, patch] of Object.entries(cells)) {
        if (!/^\d+:\d+$/.test(key)) continue;
        map[key] = {
          value: normalizeValue(patch?.value ?? null),
          formula: String(patch?.formula || ""),
        };
      }

      if (Object.keys(map).length) out[String(sheetId)] = map;
    }

    return out;
  }

  _normVat(value, fallback) {
    return this.normalizePercentDecimal(value, fallback);
  }

  _normAssembly(rawAssembly, index) {
    const base = this.createAssembly(index);
    const rawAbbr = this.keepAbbr(rawAssembly?.abbreviation);

    return {
      id: String(rawAssembly?.id || this._createId()),
      fullName: String(rawAssembly?.fullName || base.fullName),
      abbreviation: rawAbbr || base.abbreviation,
      abbrManual: Boolean(rawAssembly?.abbrManual),
      separateConsumables: Boolean(rawAssembly?.separateConsumables),
      main: this._normPosList(rawAssembly?.main),
      consumable: this._normPosList(rawAssembly?.consumable),
      manualConsNoDisc: this.num(rawAssembly?.manualConsNoDisc, base.manualConsNoDisc),
      manualConsDisc: this.num(rawAssembly?.manualConsDisc, base.manualConsDisc),
      labor: {
        devCoeff: this.num(rawAssembly?.labor?.devCoeff, base.labor.devCoeff),
        devHours: this.num(rawAssembly?.labor?.devHours, base.labor.devHours),
        devRate: this.num(rawAssembly?.labor?.devRate, base.labor.devRate),
        assmCoeff: this.num(rawAssembly?.labor?.assmCoeff, base.labor.assmCoeff),
        assmHours: this.num(rawAssembly?.labor?.assmHours, base.labor.assmHours),
        assmRate: this.num(rawAssembly?.labor?.assmRate, base.labor.assmRate),
        profitCoeff: this.num(rawAssembly?.labor?.profitCoeff, base.labor.profitCoeff),
      },
    };
  }

  _normPosList(list) {
    return Array.isArray(list)
      ? list.map((position) => this._normPosition(position))
      : [];
  }

  _normPosition(rawPosition) {
    const base = this.createPosition();
    const markup = this.num(rawPosition?.markup, base.markup);
    const discount = this.num(rawPosition?.discount, base.discount);

    return {
      id: String(rawPosition?.id || this._createId()),
      schematic: String(rawPosition?.schematic || ""),
      name: String(rawPosition?.name || ""),
      manufacturer: String(rawPosition?.manufacturer || ""),
      article: String(rawPosition?.article || ""),
      qty: this.num(rawPosition?.qty, base.qty),
      unit: String(rawPosition?.unit || base.unit),
      priceCatalogVatMarkup: this.num(
        rawPosition?.priceCatalogVatMarkup ?? rawPosition?.priceWithoutVat,
        base.priceCatalogVatMarkup,
      ),
      markup: markup > 1 && markup <= 100 ? markup / 100 : markup,
      discount: discount > 1 && discount <= 100 ? discount / 100 : discount,
      supplier: String(rawPosition?.supplier || ""),
      note: String(rawPosition?.note || ""),
    };
  }
}
