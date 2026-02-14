import { Icon } from "../common/Icon.js";

export class StatusBar {
  constructor({ container, i18n, onZoomIn, onZoomOut } = {}) {
    this.container = container;
    this.i18n = i18n;
    this.onZoomIn = onZoomIn;
    this.onZoomOut = onZoomOut;
    this.refs = {};
    this.render();
  }

  render() {
    this.container.innerHTML = "";

    const bar = document.createElement("footer");
    bar.className = "status-bar";

    const documentInfo = this.makeField("file", "");
    const editsInfo = this.makeField("pencil", "");
    const jobsInfo = this.makeField("activity", "");

    const jobsProgress = document.createElement("div");
    jobsProgress.className = "status-jobs-progress";
    const jobsProgressFill = document.createElement("div");
    jobsProgressFill.className = "status-jobs-progress-fill";
    jobsProgress.appendChild(jobsProgressFill);

    const zoom = document.createElement("div");
    zoom.className = "status-zoom";

    const zoomOut = this.makeIconButton("zoom-out", "status.zoomOut", () => this.onZoomOut?.());
    const zoomValue = document.createElement("span");
    zoomValue.className = "status-zoom-value";
    const zoomIn = this.makeIconButton("zoom-in", "status.zoomIn", () => this.onZoomIn?.());

    zoom.append(zoomOut, zoomValue, zoomIn);

    const hotkeyHint = document.createElement("div");
    hotkeyHint.className = "status-hint";

    const cursorInfo = this.makeField("panel", "");

    bar.append(documentInfo.wrap, editsInfo.wrap, jobsInfo.wrap, jobsProgress, zoom, cursorInfo.wrap, hotkeyHint);
    this.container.appendChild(bar);

    this.refs = {
      documentInfo,
      editsInfo,
      jobsInfo,
      jobsProgressFill,
      zoomValue,
      hotkeyHint,
      cursorInfo
    };
  }

  update({ templateName, hasUnsavedChanges, jobsSummary, zoom, activeCell }) {
    this.refs.documentInfo.value.textContent = this.i18n.t("status.template", { name: templateName || this.i18n.t("status.noFile") });
    this.refs.editsInfo.value.textContent = this.i18n.t("status.edits", { value: hasUnsavedChanges ? this.i18n.t("status.yes") : this.i18n.t("status.no") });

    const running = Number(jobsSummary?.running || 0);
    const total = Number(jobsSummary?.total || 0);
    this.refs.jobsInfo.value.textContent = this.i18n.t("status.jobs", { running, total });
    const progress = total <= 0 ? 0 : Math.round((running / total) * 100);
    this.refs.jobsProgressFill.style.width = `${progress}%`;

    this.refs.zoomValue.textContent = this.i18n.t("status.zoomValue", { value: Number(zoom || 1).toFixed(2) });
    this.refs.hotkeyHint.textContent = this.i18n.t("status.commandSearchHint");
    this.refs.cursorInfo.value.textContent = this.i18n.t("status.cell", { cell: activeCell || "-" });
  }

  makeField(iconName, text) {
    const wrap = document.createElement("div");
    wrap.className = "status-field";
    wrap.appendChild(Icon({ name: iconName, size: 12 }));
    const value = document.createElement("span");
    value.textContent = text;
    wrap.appendChild(value);
    return { wrap, value };
  }

  makeIconButton(icon, labelKey, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "status-icon-btn";
    button.setAttribute("aria-label", this.i18n.t(labelKey));
    button.appendChild(Icon({ name: icon, size: 12 }));
    button.addEventListener("click", onClick);
    return button;
  }
}
