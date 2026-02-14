export class FindPanel {
  constructor(container, callbacks = {}, { i18n } = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.i18n = i18n;
    this.refs = {};
  }

  render(state = {}) {
    this.container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "find-panel";

    const needle = document.createElement("input");
    needle.type = "text";
    needle.className = "dialog-input";
    needle.placeholder = this.i18n.t("find.needle");
    needle.value = state.needle || "";

    const replace = document.createElement("input");
    replace.type = "text";
    replace.className = "dialog-input";
    replace.placeholder = this.i18n.t("find.replace");
    replace.value = state.replace || "";

    const flags = document.createElement("div");
    flags.className = "qc-filters";

    const scope = document.createElement("select");
    scope.className = "dialog-input";
    scope.innerHTML = `<option value="sheet">${this.i18n.t("find.scopeSheet")}</option><option value="workbook">${this.i18n.t("find.scopeWorkbook")}</option>`;
    scope.value = state.scope || "sheet";

    const caseBox = this.makeCheck(this.i18n.t("find.case"), Boolean(state.matchCase));
    const wholeBox = this.makeCheck(this.i18n.t("find.whole"), Boolean(state.wholeCell));
    const regexBox = this.makeCheck(this.i18n.t("find.regex"), Boolean(state.useRegex));

    flags.append(scope, caseBox.wrap, wholeBox.wrap, regexBox.wrap);

    const actions = document.createElement("div");
    actions.className = "qc-actions";

    const searchBtn = this.btn(this.i18n.t("find.run"), () => this.callbacks.onSearch?.(this.getQuery()));
    const prevBtn = this.btn(this.i18n.t("find.prev"), () => this.callbacks.onPrev?.());
    const nextBtn = this.btn(this.i18n.t("find.next"), () => this.callbacks.onNext?.());
    const oneBtn = this.btn(this.i18n.t("find.replaceOne"), () => this.callbacks.onReplaceOne?.({ ...this.getQuery(), replacement: replace.value }));
    const allBtn = this.btn(this.i18n.t("find.replaceAll"), () => this.callbacks.onReplaceAll?.({ ...this.getQuery(), replacement: replace.value }));

    actions.append(searchBtn, prevBtn, nextBtn, oneBtn, allBtn);

    const list = document.createElement("div");
    list.className = "qc-list";

    if (!(state.results || []).length) {
      const empty = document.createElement("div");
      empty.className = "changes-empty";
      empty.textContent = this.i18n.t("find.empty");
      list.appendChild(empty);
    } else {
      for (let i = 0; i < (state.results || []).length; i += 1) {
        const item = state.results[i];
        const row = document.createElement("button");
        row.type = "button";
        row.className = "qc-item";
        row.classList.toggle("active", i === state.activeIndex);
        row.textContent = `${item.sheetName} ${item.addressA1}: ${item.text.slice(0, 60)}`;
        row.addEventListener("click", () => this.callbacks.onSelect?.(i));
        list.appendChild(row);
      }
    }

    root.append(needle, replace, flags, actions, list);
    this.container.appendChild(root);

    needle.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.callbacks.onSearch?.(this.getQuery());
      }
    });

    this.refs = { needle, replace, scope, caseBox, wholeBox, regexBox };
  }

  getQuery() {
    return {
      needle: this.refs.needle?.value || "",
      scope: this.refs.scope?.value || "sheet",
      matchCase: this.refs.caseBox?.input?.checked || false,
      wholeCell: this.refs.wholeBox?.input?.checked || false,
      useRegex: this.refs.regexBox?.input?.checked || false
    };
  }

  makeCheck(label, checked) {
    const wrap = document.createElement("label");
    wrap.className = "dialog-message";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    wrap.append(input, document.createTextNode(` ${label}`));
    return { wrap, input };
  }

  btn(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }
}
