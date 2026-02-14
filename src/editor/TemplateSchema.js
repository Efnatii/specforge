const DEFAULT_SCHEMA = {
  schemaVersion: 1,
  sheets: [
    {
      match: { nameEquals: "Общее" },
      editable: [
        { a1: "B4" },
        { range: "B10:D10" },
        { range: "A20:H200" }
      ],
      required: ["B4", "B5"],
      constraints: [
        { range: "E10:E200", type: "number", min: 0 },
        { range: "F10:F200", type: "integer", min: 0 }
      ]
    },
    {
      match: { nameStartsWith: "Расход. мат." },
      editable: [
        { range: "A1:K500" }
      ]
    },
    {
      match: { any: true },
      editable: [
        { range: "A1:XFD1048576" }
      ]
    }
  ]
};

export class AddressRangeUtil {
  static parseA1(addressA1) {
    const text = String(addressA1 || "").trim();
    const match = /^([A-Z]+)(\d+)$/i.exec(text);
    if (!match) {
      throw new Error(`Invalid address: ${addressA1}`);
    }

    const colText = match[1].toUpperCase();
    const row = Number(match[2]);
    let col = 0;

    for (let i = 0; i < colText.length; i += 1) {
      col = col * 26 + (colText.charCodeAt(i) - 64);
    }

    return { row, col };
  }

  static toA1(row, col) {
    if (row < 1 || col < 1) {
      throw new Error(`Invalid coordinates: r${row} c${col}`);
    }

    let value = col;
    let letters = "";

    while (value > 0) {
      const rem = (value - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      value = Math.floor((value - 1) / 26);
    }

    return `${letters}${row}`;
  }

  static parseRange(rangeText) {
    const raw = String(rangeText || "").trim();
    const parts = raw.split(":");

    if (parts.length === 1) {
      const point = AddressRangeUtil.parseA1(parts[0]);
      return { top: point.row, left: point.col, bottom: point.row, right: point.col };
    }

    if (parts.length !== 2) {
      throw new Error(`Invalid range: ${rangeText}`);
    }

    const a = AddressRangeUtil.parseA1(parts[0]);
    const b = AddressRangeUtil.parseA1(parts[1]);

    return {
      top: Math.min(a.row, b.row),
      left: Math.min(a.col, b.col),
      bottom: Math.max(a.row, b.row),
      right: Math.max(a.col, b.col)
    };
  }

  static contains(range, addressA1) {
    const point = AddressRangeUtil.parseA1(addressA1);
    return point.row >= range.top && point.row <= range.bottom && point.col >= range.left && point.col <= range.right;
  }
}

export class TemplateSchema {
  constructor(schema) {
    this.schema = this.normalizeSchema(schema);
  }

  static async load(url) {
    if (!url) {
      return new TemplateSchema(DEFAULT_SCHEMA);
    }

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        return new TemplateSchema(DEFAULT_SCHEMA);
      }

      const payload = await response.json();
      return new TemplateSchema(payload);
    } catch {
      return new TemplateSchema(DEFAULT_SCHEMA);
    }
  }

  isCellEditable(sheetName, addressA1, baselineCell) {
    if (baselineCell?.formula) {
      return false;
    }

    const rules = this.getRulesForSheet(sheetName);
    if (rules.length === 0) {
      return false;
    }

    for (const rule of rules) {
      for (const range of rule.parsedEditableRanges) {
        if (AddressRangeUtil.contains(range, addressA1)) {
          return true;
        }
      }
    }

    return false;
  }

  findFirstEditableAddress(sheetName, fallbackAddress = "A1") {
    const rule = this.getRulesForSheet(sheetName)[0];
    if (!rule || rule.parsedEditableRanges.length === 0) {
      return fallbackAddress;
    }

    const first = rule.parsedEditableRanges[0];
    return AddressRangeUtil.toA1(first.top, first.left);
  }

  getEditableRangesForSheet(sheetName) {
    const ranges = [];
    for (const rule of this.getRulesForSheet(sheetName)) {
      ranges.push(...rule.parsedEditableRanges);
    }
    return ranges;
  }

  getRequiredRulesForSheet(sheetName) {
    const out = [];
    for (const rule of this.getRulesForSheet(sheetName)) {
      out.push(...(rule.required || []));
    }
    return out;
  }

  getConstraintsForSheet(sheetName) {
    const out = [];
    for (const rule of this.getRulesForSheet(sheetName)) {
      out.push(...(rule.constraints || []));
    }
    return out;
  }

  getRulesForSheet(sheetName) {
    return this.schema.sheets.filter((item) => this.matchesSheet(item.match, sheetName));
  }

  normalizeSchema(schema) {
    const raw = schema && typeof schema === "object" ? schema : DEFAULT_SCHEMA;

    const sheets = Array.isArray(raw.sheets) ? raw.sheets : DEFAULT_SCHEMA.sheets;
    const normalizedSheets = sheets.map((item) => {
      const parsedEditableRanges = [];

      for (const editableRule of item.editable || []) {
        if (editableRule.a1) {
          parsedEditableRanges.push(AddressRangeUtil.parseRange(editableRule.a1));
        }
        if (editableRule.range) {
          parsedEditableRanges.push(AddressRangeUtil.parseRange(editableRule.range));
        }
      }

      return {
        match: item.match || { any: true },
        parsedEditableRanges,
        required: this.normalizeRequired(item.required),
        constraints: this.normalizeConstraints(item.constraints)
      };
    });

    return {
      schemaVersion: Number(raw.schemaVersion || 1),
      sheets: normalizedSheets
    };
  }

  matchesSheet(match, sheetName) {
    if (!match || match.any) {
      return true;
    }

    if (typeof match.nameEquals === "string") {
      return sheetName === match.nameEquals;
    }

    if (typeof match.nameStartsWith === "string") {
      return sheetName.startsWith(match.nameStartsWith);
    }

    return false;
  }

  normalizeRequired(entries) {
    const out = [];
    for (const entry of entries || []) {
      if (typeof entry === "string") {
        out.push({ range: entry });
      } else if (entry?.range) {
        out.push({ range: entry.range });
      } else if (entry?.a1) {
        out.push({ range: entry.a1 });
      }
    }
    return out;
  }

  normalizeConstraints(entries) {
    const out = [];
    for (const entry of entries || []) {
      if (!entry?.range) {
        continue;
      }

      out.push({
        range: entry.range,
        type: entry.type || "number",
        min: typeof entry.min === "number" ? entry.min : null
      });
    }
    return out;
  }
}
