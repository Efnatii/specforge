import { Icon } from "./Icon.js";
import { Tooltip } from "./Tooltip.js";

export class Toolbar {
  constructor(container, callbacks, { i18n } = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.i18n = i18n;
    this.refs = { buttons: {} };
  }

  render() {
    this.container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    const fileInput = this.createFileInput((file) => this.callbacks.onLoadFilePicked(file));
    const importUpdateInput = this.createFileInput((file) => this.callbacks.onImportUpdatePicked(file));
    const importReplaceInput = this.createFileInput((file) => this.callbacks.onImportReplacePicked(file));

    const fileGroup = this.createGroup("toolbar.groupFile", [
      this.makeAction({
        id: "openFile",
        icon: "folder-open",
        label: this.i18n.t("toolbar.openFile"),
        hotkey: this.i18n.t("toolbar.hotkeys.openFile"),
        onClick: () => this.callbacks.onLoadFile()
      }),
      this.makeAction({
        id: "reset",
        icon: "rotate-ccw",
        label: this.i18n.t("toolbar.reset"),
        onClick: () => this.callbacks.onReset()
      })
    ]);

    const ioGroup = this.createGroup("toolbar.groupImportExport", [
      this.makeAction({
        id: "importUpdate",
        icon: "upload",
        label: this.i18n.t("toolbar.importUpdate"),
        onClick: () => this.callbacks.onImportUpdate()
      }),
      this.makeAction({
        id: "importReplace",
        icon: "file-up",
        label: this.i18n.t("toolbar.importReplace"),
        onClick: () => this.callbacks.onImportReplace()
      }),
      this.makeAction({
        id: "export",
        icon: "download",
        label: this.i18n.t("toolbar.exportXlsx"),
        onClick: () => this.callbacks.onExport()
      })
    ]);

    const docsGroup = this.createGroup("toolbar.groupDocs", [
      this.makeAction({
        id: "print",
        icon: "printer",
        label: this.i18n.t("toolbar.print"),
        onClick: () => this.callbacks.onPrintPreview()
      })
    ]);

    const entityGroup = this.createGroup("toolbar.groupEntities", [
      this.makeAction({
        id: "addAssembly",
        icon: "plus",
        label: this.i18n.t("toolbar.addAssembly"),
        onClick: () => this.callbacks.onAddAssembly()
      }),
      this.makeAction({
        id: "autoFill",
        icon: "wand",
        label: this.i18n.t("toolbar.autoFillPreview"),
        onClick: () => this.callbacks.onAutoFillPreview()
      }),
      this.makeAction({
        id: "workbookToModel",
        icon: "clipboard-import",
        label: this.i18n.t("toolbar.workbookToModel"),
        onClick: () => this.callbacks.onWorkbookToModelPreview()
      })
    ]);

    const toolsGroup = this.createGroup("toolbar.groupTools", [
      this.makeAction({
        id: "find",
        icon: "search",
        label: this.i18n.t("toolbar.find"),
        hotkey: this.i18n.t("toolbar.hotkeys.find"),
        onClick: () => this.callbacks.onFindPanelToggle()
      }),
      this.makeAction({
        id: "pasteSpecial",
        icon: "columns",
        label: this.i18n.t("toolbar.pasteSpecial"),
        hotkey: this.i18n.t("toolbar.hotkeys.pasteSpecial"),
        onClick: () => this.callbacks.onPasteSpecial()
      }),
      this.makeAction({
        id: "schema",
        icon: "settings",
        label: this.i18n.t("toolbar.schema"),
        onClick: () => this.callbacks.onEditSchema()
      }),
      this.makeAction({
        id: "bindings",
        icon: "list",
        label: this.i18n.t("toolbar.bindings"),
        onClick: () => this.callbacks.onEditBindings()
      }),
      this.makeAction({
        id: "chaos",
        icon: "activity",
        label: this.i18n.t("toolbar.chaos"),
        onClick: () => this.callbacks.onChaos?.()
      })
    ]);

    const exportMeta = this.createExportMetaGroup();

    fragment.append(fileGroup, ioGroup, docsGroup, entityGroup, toolsGroup, exportMeta, fileInput, importUpdateInput, importReplaceInput);
    this.container.appendChild(fragment);

    this.refs.fileInput = fileInput;
    this.refs.importUpdateInput = importUpdateInput;
    this.refs.importReplaceInput = importReplaceInput;
  }

  makeAction({ id, icon, label, hotkey = "", onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-icon";
    button.setAttribute("aria-label", label);
    button.appendChild(Icon({ name: icon, size: 18 }));
    button.addEventListener("click", onClick);

    this.refs.buttons[id] = button;
    return Tooltip.wrap(button, { text: label, hotkey });
  }

  createGroup(labelKey, actions) {
    const group = document.createElement("section");
    group.className = "toolbar-group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", this.i18n.t(labelKey));

    const title = document.createElement("div");
    title.className = "toolbar-group-title";
    title.textContent = this.i18n.t(labelKey);

    const row = document.createElement("div");
    row.className = "toolbar-group-actions";
    row.append(...actions);

    group.append(title, row);
    return group;
  }

  createExportMetaGroup() {
    const wrap = document.createElement("section");
    wrap.className = "toolbar-export-meta";
    wrap.setAttribute("aria-label", "Параметры экспорта");

    const fields = [
      this.createInput("orderNo", this.i18n.t("toolbar.orderNo")),
      this.createInput("requestNo", this.i18n.t("toolbar.requestNo")),
      this.createInput("title", this.i18n.t("toolbar.title")),
      this.createInput("modifiedDate", this.i18n.t("toolbar.modifiedDate"))
    ];

    for (const field of fields) {
      field.input.addEventListener("change", () => this.callbacks.onExportMetaChanged(this.getExportMeta()));
      wrap.appendChild(field.wrap);
    }

    this.refs.orderNo = fields[0].input;
    this.refs.requestNo = fields[1].input;
    this.refs.title = fields[2].input;
    this.refs.modifiedDate = fields[3].input;

    return wrap;
  }

  createInput(key, labelText) {
    const wrap = document.createElement("label");
    wrap.className = "toolbar-field";

    const label = document.createElement("span");
    label.className = "toolbar-field-label";
    label.textContent = labelText;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "toolbar-input";
    input.dataset.key = key;
    input.setAttribute("aria-label", labelText);

    wrap.append(label, input);
    return { wrap, input };
  }

  createFileInput(onPick) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx";
    input.className = "file-input-hidden";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        onPick(file);
      }
      input.value = "";
    });
    return input;
  }

  openLoadPicker() {
    this.refs.fileInput?.click();
  }

  openImportUpdatePicker() {
    this.refs.importUpdateInput?.click();
  }

  openImportReplacePicker() {
    this.refs.importReplaceInput?.click();
  }

  setExportMeta(meta) {
    this.applyInputValue(this.refs.orderNo, meta.orderNo || "");
    this.applyInputValue(this.refs.requestNo, meta.requestNo || "");
    this.applyInputValue(this.refs.title, meta.title || "");
    this.applyInputValue(this.refs.modifiedDate, meta.modifiedDate || "");
  }

  getExportMeta() {
    return {
      orderNo: this.refs.orderNo?.value || "",
      requestNo: this.refs.requestNo?.value || "",
      title: this.refs.title?.value || "",
      modifiedDate: this.refs.modifiedDate?.value || ""
    };
  }

  setAvailability({ hasBaseline }) {
    this.setDisabled("export", !hasBaseline);
    this.setDisabled("print", !hasBaseline);
    this.setDisabled("importUpdate", !hasBaseline);
    this.setDisabled("addAssembly", !hasBaseline);
    this.setDisabled("autoFill", !hasBaseline);
    this.setDisabled("workbookToModel", !hasBaseline);
    this.setDisabled("pasteSpecial", !hasBaseline);
  }

  setDisabled(id, disabled) {
    const btn = this.refs.buttons[id];
    if (btn) {
      btn.disabled = Boolean(disabled);
      if (btn.parentElement?.classList.contains("tooltip-anchor")) {
        btn.parentElement.tabIndex = disabled ? 0 : -1;
      }
    }
  }

  applyInputValue(input, value) {
    if (!input || document.activeElement === input) {
      return;
    }
    if (input.value !== value) {
      input.value = value;
    }
  }
}
