import { RangeOps } from "./RangeOps.js";

export class SelectionModel {
  constructor() {
    this.anchor = null;
    this.focus = null;
    this.range = null;
    this.mode = "cell";
  }

  setAnchor(sheetId, addressA1) {
    const rc = RangeOps.a1ToRc(addressA1);
    this.anchor = { sheetId, addressA1, ...rc };
    this.focus = { sheetId, addressA1, ...rc };
    this.range = { r1: rc.r, c1: rc.c, r2: rc.r, c2: rc.c };
    this.mode = "cell";
  }

  setFocus(sheetId, addressA1, { extend = false } = {}) {
    const rc = RangeOps.a1ToRc(addressA1);

    if (!this.anchor || !extend || this.anchor.sheetId !== sheetId) {
      this.anchor = { sheetId, addressA1, ...rc };
      this.focus = { sheetId, addressA1, ...rc };
      this.range = { r1: rc.r, c1: rc.c, r2: rc.r, c2: rc.c };
      this.mode = "cell";
      return;
    }

    this.focus = { sheetId, addressA1, ...rc };
    this.range = RangeOps.normalizeRange({
      r1: this.anchor.r,
      c1: this.anchor.c,
      r2: rc.r,
      c2: rc.c
    });
    this.mode = this.isSingleCell() ? "cell" : "range";
  }

  moveFocus(sheetId, deltaRow, deltaCol, { extend = false, bounds = null } = {}) {
    if (!this.focus || this.focus.sheetId !== sheetId) {
      this.setAnchor(sheetId, "A1");
    }

    const current = this.focus || this.anchor;
    const next = {
      r: current.r + deltaRow,
      c: current.c + deltaCol
    };

    if (bounds) {
      next.r = Math.max(1, Math.min(bounds.maxRow, next.r));
      next.c = Math.max(1, Math.min(bounds.maxCol, next.c));
    } else {
      next.r = Math.max(1, next.r);
      next.c = Math.max(1, next.c);
    }

    this.setFocus(sheetId, RangeOps.rcToA1(next), { extend });
  }

  setRangeByDrag(sheetId, startAddressA1, endAddressA1) {
    this.setAnchor(sheetId, startAddressA1);
    this.setFocus(sheetId, endAddressA1, { extend: true });
  }

  *getSelectedAddressesIterator({ limit = null } = {}) {
    if (!this.range) {
      return;
    }

    let count = 0;
    for (const item of RangeOps.iterRange(this.range)) {
      yield item.addressA1;
      count += 1;
      if (limit && count >= limit) {
        break;
      }
    }
  }

  getRangeA1() {
    if (!this.range) {
      return null;
    }

    return `${RangeOps.rcToA1({ r: this.range.r1, c: this.range.c1 })}:${RangeOps.rcToA1({ r: this.range.r2, c: this.range.c2 })}`;
  }

  isSingleCell() {
    if (!this.range) {
      return true;
    }

    return this.range.r1 === this.range.r2 && this.range.c1 === this.range.c2;
  }
}
