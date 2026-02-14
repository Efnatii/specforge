export class RibbonTab {
  constructor({ id, title, groups = [] }) {
    this.id = id;
    this.title = title;
    this.groups = groups;
  }
}
