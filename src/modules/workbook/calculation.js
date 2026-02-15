export class WorkbookCalculationModule {
  constructor({ math }) {
    if (!math) throw new Error("WorkbookCalculationModule requires math helpers");
    this._math = math;
  }

  calcItem(raw, vat) {
    const qty = this._num(raw.qty);
    const pCatalog = this._num(raw.priceCatalogVatMarkup ?? raw.priceWithoutVat);
    const markup = this._num(raw.markup);
    const discount = this._num(raw.discount);

    const divider = (1 + vat) * (1 + markup);
    const baseNoVat = divider > 0 ? pCatalog / divider : 0;
    const priceNoVat = baseNoVat * (1 + markup);
    const priceVat = priceNoVat * (1 + vat);
    const sumNoVat = qty * priceNoVat;
    const sumVat = qty * priceVat;

    const discPriceNoVat = baseNoVat * (1 - discount);
    const discPriceVat = discPriceNoVat * (1 + vat);
    const discSumNoVat = qty * discPriceNoVat;
    const discSumVat = qty * discPriceVat;

    return {
      raw,
      baseNoVat,
      priceNoVat,
      priceVat,
      sumNoVat,
      sumVat,
      discPriceNoVat,
      discPriceVat,
      discSumNoVat,
      discSumVat,
    };
  }

  calcAssemblyMetrics(assembly, vat) {
    const mainList = Array.isArray(assembly.main) ? assembly.main : [];
    const consList = Array.isArray(assembly.consumable) ? assembly.consumable : [];
    const main = mainList.map((position) => this.calcItem(position, vat));
    const cons = consList.map((position) => this.calcItem(position, vat));

    const mainNoDisc = main.reduce((sum, item) => sum + item.sumVat, 0);
    const mainDisc = main.reduce((sum, item) => sum + item.discSumVat, 0);

    const consNoDisc = assembly.separateConsumables
      ? this._ceil1(cons.reduce((sum, item) => sum + item.sumVat, 0))
      : this._num(assembly.manualConsNoDisc);
    const consDisc = assembly.separateConsumables
      ? this._ceil1(cons.reduce((sum, item) => sum + item.discSumVat, 0))
      : this._num(assembly.manualConsDisc);

    const baseNoDisc = mainNoDisc + consNoDisc;
    const baseDisc = mainDisc + consDisc;

    const devTax = this._num(assembly.labor.devRate) * 0.6;
    const devTotal = this._num(assembly.labor.devHours) * (this._num(assembly.labor.devRate) + devTax);
    const devCoeff = devTotal * this._num(assembly.labor.devCoeff);

    const assmTax = this._num(assembly.labor.assmRate) * 0.6;
    const assmTotal = this._num(assembly.labor.assmHours) * (this._num(assembly.labor.assmRate) + assmTax);
    const assmCoeff = assmTotal * this._num(assembly.labor.assmCoeff);

    const profitNoDisc = (baseNoDisc + devCoeff + assmCoeff) * this._num(assembly.labor.profitCoeff);
    const profitDisc = (baseDisc + devCoeff + assmCoeff) * this._num(assembly.labor.profitCoeff);

    const totalNoDisc = this._ceil1(baseNoDisc + devCoeff + assmCoeff + profitNoDisc);
    const totalDisc = baseDisc + devCoeff + assmCoeff + profitDisc;

    return {
      main,
      cons,
      consNoDisc,
      consDisc,
      baseNoDisc,
      baseDisc,
      devTax,
      devTotal,
      devCoeff,
      assmTax,
      assmTotal,
      assmCoeff,
      profitNoDisc,
      profitDisc,
      totalNoDisc,
      totalDisc,
    };
  }

  _num(value, fallback = 0) {
    return this._math.num(value, fallback);
  }

  _ceil1(value) {
    return this._math.ceil1(value);
  }
}
