export class CellDomPool {
  constructor({ create }) {
    this.create = create;
    this.free = [];
  }

  acquire() {
    return this.free.pop() || this.create();
  }

  release(node) {
    node.remove();
    this.free.push(node);
  }

  clear() {
    this.free = [];
  }
}
