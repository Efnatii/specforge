export class AuditLog {
  constructor(limit = 200) {
    this.limit = limit;
    this.entries = [];
  }

  add(entry) {
    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries.shift();
    }
  }

  clear() {
    this.entries = [];
  }

  getRecent(limit = 50) {
    return this.entries.slice(-limit).reverse();
  }
}
