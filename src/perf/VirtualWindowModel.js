export class VirtualWindowModel {
  constructor({ rowHeightsPx = [], colWidthsPx = [], viewportWidthPx = 0, viewportHeightPx = 0, overscanPx = 300 }) {
    this.overscanPx = overscanPx;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.viewportWidthPx = viewportWidthPx;
    this.viewportHeightPx = viewportHeightPx;
    this.updateGeometry(rowHeightsPx, colWidthsPx);
  }

  updateGeometry(rowHeightsPx, colWidthsPx) {
    this.rowHeightsPx = rowHeightsPx;
    this.colWidthsPx = colWidthsPx;
    this.rowPrefix = this.buildPrefix(rowHeightsPx);
    this.colPrefix = this.buildPrefix(colWidthsPx);
    this.totalHeightPx = this.rowPrefix[this.rowPrefix.length - 1] || 0;
    this.totalWidthPx = this.colPrefix[this.colPrefix.length - 1] || 0;
  }

  updateViewportSize(w, h) {
    this.viewportWidthPx = Math.max(0, Math.floor(w));
    this.viewportHeightPx = Math.max(0, Math.floor(h));
  }

  updateScroll(scrollLeft, scrollTop) {
    this.scrollLeft = Math.max(0, Math.floor(scrollLeft));
    this.scrollTop = Math.max(0, Math.floor(scrollTop));
  }

  getVisibleRange() {
    const topPx = Math.max(0, this.scrollTop - this.overscanPx);
    const bottomPx = Math.min(this.totalHeightPx, this.scrollTop + this.viewportHeightPx + this.overscanPx);
    const leftPx = Math.max(0, this.scrollLeft - this.overscanPx);
    const rightPx = Math.min(this.totalWidthPx, this.scrollLeft + this.viewportWidthPx + this.overscanPx);

    const r1 = this.findIndexAtOffset(this.rowPrefix, topPx) + 1;
    const r2 = this.findIndexAtOffset(this.rowPrefix, Math.max(0, bottomPx - 1)) + 1;
    const c1 = this.findIndexAtOffset(this.colPrefix, leftPx) + 1;
    const c2 = this.findIndexAtOffset(this.colPrefix, Math.max(0, rightPx - 1)) + 1;

    return {
      r1: Math.max(1, Math.min(r1, this.rowHeightsPx.length || 1)),
      r2: Math.max(1, Math.min(r2, this.rowHeightsPx.length || 1)),
      c1: Math.max(1, Math.min(c1, this.colWidthsPx.length || 1)),
      c2: Math.max(1, Math.min(c2, this.colWidthsPx.length || 1)),
      offsetTopPx: this.rowPrefix[Math.max(0, r1 - 1)] || 0,
      offsetLeftPx: this.colPrefix[Math.max(0, c1 - 1)] || 0
    };
  }

  rowColFromPoint(xPx, yPx) {
    const row = this.findIndexAtOffset(this.rowPrefix, Math.max(0, yPx)) + 1;
    const col = this.findIndexAtOffset(this.colPrefix, Math.max(0, xPx)) + 1;
    return {
      row: Math.max(1, Math.min(row, this.rowHeightsPx.length || 1)),
      col: Math.max(1, Math.min(col, this.colWidthsPx.length || 1))
    };
  }

  rectForRange(range) {
    const r1 = Math.max(1, range.r1);
    const c1 = Math.max(1, range.c1);
    const r2 = Math.max(r1, range.r2);
    const c2 = Math.max(c1, range.c2);

    const x = this.colPrefix[c1 - 1] || 0;
    const y = this.rowPrefix[r1 - 1] || 0;
    const right = this.colPrefix[c2] || x;
    const bottom = this.rowPrefix[r2] || y;

    return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
  }

  buildPrefix(sizes) {
    const prefix = [0];
    let sum = 0;
    for (const size of sizes) {
      sum += size;
      prefix.push(sum);
    }
    return prefix;
  }

  findIndexAtOffset(prefix, offset) {
    let low = 0;
    let high = prefix.length - 2;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const start = prefix[mid];
      const end = prefix[mid + 1];
      if (offset < start) {
        high = mid - 1;
      } else if (offset >= end) {
        low = mid + 1;
      } else {
        return mid;
      }
    }

    return Math.max(0, Math.min(prefix.length - 2, low));
  }
}
