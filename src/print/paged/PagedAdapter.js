export class PagedAdapter {
  constructor() {
    this.enabled = false;
  }

  isAvailable() {
    return false;
  }

  async renderPreview() {
    return false;
  }
}
