const DEFAULT_ITEMS_TABLE = {
  startRow: 10,
  maxRows: 500,
  cols: {
    pos: "A",
    title: "B",
    mfr: "F",
    sku: "G",
    qty: "H",
    unit: "I",
    price: "J",
    sum: "K"
  }
};

const DEFAULT_BINDING_MAP = {
  version: 1,
  commonSheet: {
    name: "Общее",
    meta: {
      orderNo: "B2",
      requestNo: "F2",
      modifiedDate: "J2"
    },
    assembliesTable: {
      startRow: 12,
      maxRows: 200,
      cols: {
        abbr: "A",
        name: "B",
        qty: "H",
        unit: "I",
        comment: "J"
      }
    }
  },
  assemblySheet: {
    header: {
      abbr: "B2",
      name: "B3",
      qty: "H2"
    },
    itemsTable: DEFAULT_ITEMS_TABLE
  },
  consumablesSheet: {
    header: {
      abbr: "B2",
      name: "B3",
      qty: "H2"
    },
    itemsTable: DEFAULT_ITEMS_TABLE
  }
};

export class BindingMap {
  constructor(map) {
    this.map = this.normalize(map);
  }

  static async load(url) {
    if (!url) {
      return new BindingMap(DEFAULT_BINDING_MAP);
    }

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        return new BindingMap(DEFAULT_BINDING_MAP);
      }

      const json = await response.json();
      return new BindingMap(json);
    } catch {
      return new BindingMap(DEFAULT_BINDING_MAP);
    }
  }

  normalize(map) {
    const source = map && typeof map === "object" ? map : DEFAULT_BINDING_MAP;
    const version = Number(source.version || 1);
    if (version !== 1) {
      return DEFAULT_BINDING_MAP;
    }

    return {
      version,
      commonSheet: {
        ...DEFAULT_BINDING_MAP.commonSheet,
        ...(source.commonSheet || {}),
        meta: {
          ...DEFAULT_BINDING_MAP.commonSheet.meta,
          ...(source.commonSheet?.meta || {})
        },
        assembliesTable: {
          ...DEFAULT_BINDING_MAP.commonSheet.assembliesTable,
          ...(source.commonSheet?.assembliesTable || {}),
          cols: {
            ...DEFAULT_BINDING_MAP.commonSheet.assembliesTable.cols,
            ...(source.commonSheet?.assembliesTable?.cols || {})
          }
        }
      },
      assemblySheet: {
        ...DEFAULT_BINDING_MAP.assemblySheet,
        ...(source.assemblySheet || {}),
        header: {
          ...DEFAULT_BINDING_MAP.assemblySheet.header,
          ...(source.assemblySheet?.header || {})
        },
        itemsTable: {
          ...DEFAULT_BINDING_MAP.assemblySheet.itemsTable,
          ...(source.assemblySheet?.itemsTable || {}),
          cols: {
            ...DEFAULT_BINDING_MAP.assemblySheet.itemsTable.cols,
            ...(source.assemblySheet?.itemsTable?.cols || {})
          }
        }
      },
      consumablesSheet: {
        ...DEFAULT_BINDING_MAP.consumablesSheet,
        ...(source.consumablesSheet || {}),
        header: {
          ...DEFAULT_BINDING_MAP.consumablesSheet.header,
          ...(source.consumablesSheet?.header || {})
        },
        itemsTable: {
          ...DEFAULT_BINDING_MAP.consumablesSheet.itemsTable,
          ...(source.consumablesSheet?.itemsTable || {}),
          cols: {
            ...DEFAULT_BINDING_MAP.consumablesSheet.itemsTable.cols,
            ...(source.consumablesSheet?.itemsTable?.cols || {})
          }
        }
      }
    };
  }

  get() {
    return this.map;
  }

  colRowToA1(col, row) {
    return `${col}${row}`;
  }
}
