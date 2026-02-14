export class TkpModel {
  static createDefault() {
    const now = Date.now();
    return {
      meta: {
        orderNo: "",
        requestNo: "",
        title: "КП Общая",
        modifiedDate: TkpModel.today()
      },
      assemblies: [],
      lastUpdatedTs: now
    };
  }

  static sanitize(model) {
    const base = TkpModel.createDefault();
    const source = model || {};

    return {
      meta: {
        orderNo: String(source.meta?.orderNo || base.meta.orderNo),
        requestNo: String(source.meta?.requestNo || base.meta.requestNo),
        title: String(source.meta?.title || base.meta.title),
        modifiedDate: String(source.meta?.modifiedDate || base.meta.modifiedDate)
      },
      assemblies: Array.isArray(source.assemblies) ? source.assemblies.map((item) => ({
        abbr: String(item.abbr || ""),
        name: String(item.name || ""),
        qty: item.qty === null || item.qty === undefined || item.qty === "" ? null : Number(item.qty),
        unit: String(item.unit || "компл."),
        comment: String(item.comment || ""),
        include: item.include !== false
      })) : [],
      lastUpdatedTs: Number(source.lastUpdatedTs || Date.now())
    };
  }

  static today() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }
}
