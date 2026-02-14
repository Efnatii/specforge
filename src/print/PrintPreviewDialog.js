export class PrintPreviewDialog {
  constructor(root, { i18n } = {}) {
    this.root = root;
    this.i18n = i18n;
  }

  open({ templates, sheets, assemblies, defaults }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog print-dialog";

      const title = document.createElement("h3");
      title.className = "dialog-title";
      title.textContent = this.i18n.t("dialog.printTitle");

      const templateSelect = document.createElement("select");
      templateSelect.className = "dialog-input";
      for (const template of templates) {
        const option = document.createElement("option");
        option.value = template.id;
        option.textContent = template.title;
        templateSelect.appendChild(option);
      }
      templateSelect.value = defaults?.templateId || templates[0]?.id;

      const assemblySelect = document.createElement("select");
      assemblySelect.className = "dialog-input";
      assemblySelect.innerHTML = `<option value=''>${this.i18n.t("dialog.printAssemblyOptional")}</option>`;
      for (const item of assemblies || []) {
        const option = document.createElement("option");
        option.value = item.abbr;
        option.textContent = `${item.abbr} ${item.name || ""}`;
        assemblySelect.appendChild(option);
      }

      const useSetupWrap = document.createElement("label");
      useSetupWrap.className = "dialog-message";
      const useSetup = document.createElement("input");
      useSetup.type = "checkbox";
      useSetup.checked = true;
      useSetupWrap.append(useSetup, document.createTextNode(` ${this.i18n.t("dialog.printUseSheetSetup")}`));

      const summary = document.createElement("div");
      summary.className = "dialog-message";
      summary.textContent = this.i18n.t("dialog.printSheetsSummary", {
        names: (sheets || []).map((item) => item.name).join(", ")
      });

      const actions = document.createElement("div");
      actions.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = this.i18n.t("common.close");

      const preview = document.createElement("button");
      preview.type = "button";
      preview.textContent = this.i18n.t("dialog.printPreview");

      const print = document.createElement("button");
      print.type = "button";
      print.textContent = this.i18n.t("dialog.printStart");

      const payload = () => ({
        templateId: templateSelect.value,
        selectedAbbr: assemblySelect.value || null,
        useSheetPageSetup: useSetup.checked
      });

      cancel.addEventListener("click", () => {
        backdrop.remove();
        resolve(null);
      });

      preview.addEventListener("click", () => {
        backdrop.remove();
        resolve({ mode: "preview", ...payload() });
      });

      print.addEventListener("click", () => {
        backdrop.remove();
        resolve({ mode: "print", ...payload() });
      });

      actions.append(cancel, preview, print);
      dialog.append(title, templateSelect, assemblySelect, useSetupWrap, summary, actions);
      backdrop.appendChild(dialog);
      this.root.appendChild(backdrop);
    });
  }

  showHtmlPreview(root, htmlString) {
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";

    const dialog = document.createElement("div");
    dialog.className = "dialog print-preview-host";

    const title = document.createElement("h3");
    title.className = "dialog-title";
    title.textContent = this.i18n.t("dialog.printPreviewTitle");

    const frame = document.createElement("iframe");
    frame.className = "print-preview-frame";
    frame.srcdoc = htmlString;

    const actions = document.createElement("div");
    actions.className = "dialog-buttons";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = this.i18n.t("common.close");
    close.addEventListener("click", () => backdrop.remove());

    actions.append(close);
    dialog.append(title, frame, actions);
    backdrop.appendChild(dialog);
    root.appendChild(backdrop);
  }
}
