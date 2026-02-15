import { DOM_ID_SELECTORS, DOM_QUERY_ALL_SELECTORS } from "../../../config/domSelectors.js";

export class AppDomModule {
  constructor({
    documentRef,
    idSelectors = DOM_ID_SELECTORS,
    queryAllSelectors = DOM_QUERY_ALL_SELECTORS,
  }) {
    if (!documentRef) throw new Error("AppDomModule requires documentRef");
    if (!idSelectors || typeof idSelectors !== "object") throw new Error("AppDomModule requires idSelectors");
    if (!queryAllSelectors || typeof queryAllSelectors !== "object") throw new Error("AppDomModule requires queryAllSelectors");

    this._document = documentRef;
    this._idSelectors = idSelectors;
    this._queryAllSelectors = queryAllSelectors;
  }

  createDomRefs() {
    const refs = {};
    for (const [key, id] of Object.entries(this._idSelectors)) {
      refs[key] = this._document.getElementById(id);
    }
    for (const [key, selector] of Object.entries(this._queryAllSelectors)) {
      refs[key] = Array.from(this._document.querySelectorAll(selector));
    }
    return refs;
  }
}
