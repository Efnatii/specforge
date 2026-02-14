export class Toolbar {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.refs = {};
  }

  render() {
    this.container.innerHTML = "";

    const loadFileButton = this.createButton("Load file", () => this.callbacks.onLoadFile());
    const resetButton = this.createButton("Reset", () => this.callbacks.onReset());
    const exportButton = this.createButton("Export .xlsx", () => this.callbacks.onExport());
    const printButton = this.createButton("Print/Preview", () => this.callbacks.onPrintPreview());
    const importUpdateButton = this.createButton("Import (Update)", () => this.callbacks.onImportUpdate());
    const importReplaceButton = this.createButton("Import (Replace Template)", () => this.callbacks.onImportReplace());
    const addAssemblyButton = this.createButton("+ Assembly", () => this.callbacks.onAddAssembly());
    const autoFillButton = this.createButton("AutoFill Preview", () => this.callbacks.onAutoFillPreview());
    const importModelButton = this.createButton("Workbook -> Model", () => this.callbacks.onWorkbookToModelPreview());
    const findButton = this.createButton("Find/Replace", () => this.callbacks.onFindPanelToggle());
    const pasteSpecialButton = this.createButton("Paste Special", () => this.callbacks.onPasteSpecial());
    const schemaButton = this.createButton("Edit Schema", () => this.callbacks.onEditSchema());
    const bindingsButton = this.createButton("Edit Bindings", () => this.callbacks.onEditBindings());

    const orderNo = this.createInput("Order No", "orderNo");
    const requestNo = this.createInput("Request No", "requestNo");
    const title = this.createInput("Title", "title");
    const modifiedDate = this.createInput("Date", "modifiedDate");

    const fileInput = this.createFileInput((file) => this.callbacks.onLoadFilePicked(file));
    const importUpdateInput = this.createFileInput((file) => this.callbacks.onImportUpdatePicked(file));
    const importReplaceInput = this.createFileInput((file) => this.callbacks.onImportReplacePicked(file));

    for (const input of [orderNo, requestNo, title, modifiedDate]) {
      input.addEventListener("change", () => this.callbacks.onExportMetaChanged(this.getExportMeta()));
    }

    this.container.append(
      loadFileButton,
      resetButton,
      exportButton,
      printButton,
      importUpdateButton,
      importReplaceButton,
      addAssemblyButton,
      autoFillButton,
      importModelButton,
      findButton,
      pasteSpecialButton,
      schemaButton,
      bindingsButton,
      orderNo,
      requestNo,
      title,
      modifiedDate,
      fileInput,
      importUpdateInput,
      importReplaceInput
    );

    this.refs = {
      loadFileButton,
      resetButton,
      exportButton,
      printButton,
      importUpdateButton,
      importReplaceButton,
      addAssemblyButton,
      autoFillButton,
      importModelButton,
      findButton,
      pasteSpecialButton,
      schemaButton,
      bindingsButton,
      fileInput,
      importUpdateInput,
      importReplaceInput,
      orderNo,
      requestNo,
      title,
      modifiedDate
    };
  }

  createButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  createInput(placeholder, key) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.className = "toolbar-input";
    input.dataset.key = key;
    return input;
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

  openLoadPicker() { this.refs.fileInput?.click(); }
  openImportUpdatePicker() { this.refs.importUpdateInput?.click(); }
  openImportReplacePicker() { this.refs.importReplaceInput?.click(); }

  setExportMeta(meta) {
    this.applyInputValue(this.refs.orderNo, meta.orderNo || "");
    this.applyInputValue(this.refs.requestNo, meta.requestNo || "");
    this.applyInputValue(this.refs.title, meta.title || "");
    this.applyInputValue(this.refs.modifiedDate, meta.modifiedDate || "");
  }

  getExportMeta() {
    return {
      orderNo: this.refs.orderNo.value,
      requestNo: this.refs.requestNo.value,
      title: this.refs.title.value,
      modifiedDate: this.refs.modifiedDate.value
    };
  }

  setAvailability({ hasBaseline }) {
    this.refs.exportButton.disabled = !hasBaseline;
    this.refs.printButton.disabled = !hasBaseline;
    this.refs.importUpdateButton.disabled = !hasBaseline;
    this.refs.addAssemblyButton.disabled = !hasBaseline;
    this.refs.autoFillButton.disabled = !hasBaseline;
    this.refs.importModelButton.disabled = !hasBaseline;
    this.refs.pasteSpecialButton.disabled = !hasBaseline;
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
