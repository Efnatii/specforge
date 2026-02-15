export class ProjectSidebarModule {
  constructor({
    app,
    dom,
    projectStateApi,
    projectMutationApi,
    workbookApi,
    esc,
    money,
  }) {
    if (!app) throw new Error("ProjectSidebarModule requires app");
    if (!dom) throw new Error("ProjectSidebarModule requires dom");
    if (!projectStateApi) throw new Error("ProjectSidebarModule requires projectStateApi");
    if (!projectMutationApi) throw new Error("ProjectSidebarModule requires projectMutationApi");
    if (!workbookApi) throw new Error("ProjectSidebarModule requires workbookApi");
    if (typeof esc !== "function") throw new Error("ProjectSidebarModule requires esc()");
    if (typeof money !== "function") throw new Error("ProjectSidebarModule requires money()");

    this._app = app;
    this._dom = dom;
    this._projectStateApi = projectStateApi;
    this._projectMutationApi = projectMutationApi;
    this._workbookApi = workbookApi;
    this._esc = esc;
    this._money = money;
  }

  renderTree() {
    const sel = this._app.ui.treeSel;
    const p = [];

    p.push(`
    <div class="tree-item tree-item-with-actions ${this._selected(sel, { type: "settings" }) ? "is-selected" : ""}" data-node="settings">
      <span class="tree-item-label">Общие настройки</span>
      <span class="tree-item-actions">
        <button type="button" class="tree-mini-btn" data-tree-action="open-settings" title="Открыть окно настроек" aria-label="Открыть окно настроек">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4-.9-.4a7.7 7.7 0 0 0-.3-1.2l.7-.7-1.4-2.4-1 .3c-.3-.3-.7-.6-1.1-.8L15.7 5h-3.4l-.3 1.1c-.4.2-.8.5-1.1.8l-1-.3L8.5 9l.7.7c-.1.4-.2.8-.3 1.2L8 12l.9.4c.1.4.2.8.3 1.2l-.7.7 1.4 2.4 1-.3c.3.3.7.6 1.1.8l.3 1.1h3.4l.3-1.1c.4-.2.8-.5 1.1-.8l1 .3 1.4-2.4-.7-.7c.1-.4.2-.8.3-1.2z" /></svg>
        </button>
      </span>
    </div>
  `);

    for (const a of this._app.state.assemblies) {
      p.push(`<details open><summary><span class="tree-summary-label">${this._esc(a.fullName || "Сборка")} [${this._esc(a.abbreviation)}]</span><button type="button" class="tree-mini-btn" data-tree-action="dup-assembly" data-id="${a.id}" title="Дублировать сборку" aria-label="Дублировать сборку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg></button></summary>`);
      p.push(`
      <div class="tree-item tree-item-with-actions ${this._selected(sel, { type: "assembly", id: a.id }) ? "is-selected" : ""}" data-node="assembly" data-id="${a.id}">
        <span class="tree-item-label">Параметры</span>
        <span class="tree-item-actions">
          <button type="button" class="tree-mini-btn" data-tree-action="del-assembly" data-id="${a.id}" title="Удалить сборку" aria-label="Удалить сборку">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
          </button>
        </span>
      </div>
    `);

      p.push(`
      <div class="tree-item tree-item-with-actions ${this._selected(sel, { type: "list", id: a.id, list: "main" }) ? "is-selected" : ""}" data-node="list" data-id="${a.id}" data-list="main">
        <span class="tree-item-label">Осн. материалы (${a.main.length})</span>
        <span class="tree-item-actions">
          <button type="button" class="tree-mini-btn" data-tree-action="add-pos" data-id="${a.id}" data-list="main" title="Добавить позицию" aria-label="Добавить позицию">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10M17 15v6M14 18h6" /></svg>
          </button>
        </span>
      </div>
    `);
      for (const pos of a.main) {
        p.push(`
        <div class="tree-item tree-item-with-actions small ${this._selected(sel, { type: "pos", id: a.id, list: "main", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="pos" data-id="${a.id}" data-list="main" data-pos="${pos.id}">
          <span class="tree-item-label">• ${this._esc(pos.name || "Позиция")}</span>
          <span class="tree-item-actions">
            <button type="button" class="tree-mini-btn" data-tree-action="dup-pos" data-id="${a.id}" data-list="main" data-pos="${pos.id}" title="Дублировать позицию" aria-label="Дублировать позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg>
            </button>
            <button type="button" class="tree-mini-btn" data-tree-action="del-pos" data-id="${a.id}" data-list="main" data-pos="${pos.id}" title="Удалить позицию" aria-label="Удалить позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
            </button>
          </span>
        </div>
      `);
      }

      if (a.separateConsumables) {
        p.push(`
        <div class="tree-item tree-item-with-actions ${this._selected(sel, { type: "list", id: a.id, list: "cons" }) ? "is-selected" : ""}" data-node="list" data-id="${a.id}" data-list="cons">
          <span class="tree-item-label">Расх. материалы (${a.consumable.length})</span>
          <span class="tree-item-actions">
            <button type="button" class="tree-mini-btn" data-tree-action="add-pos" data-id="${a.id}" data-list="cons" title="Добавить позицию" aria-label="Добавить позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10M17 15v6M14 18h6" /></svg>
            </button>
          </span>
        </div>
      `);
        for (const pos of a.consumable) {
          p.push(`
          <div class="tree-item tree-item-with-actions small ${this._selected(sel, { type: "pos", id: a.id, list: "cons", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="pos" data-id="${a.id}" data-list="cons" data-pos="${pos.id}">
            <span class="tree-item-label">• ${this._esc(pos.name || "Позиция")}</span>
            <span class="tree-item-actions">
              <button type="button" class="tree-mini-btn" data-tree-action="dup-pos" data-id="${a.id}" data-list="cons" data-pos="${pos.id}" title="Дублировать позицию" aria-label="Дублировать позицию">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg>
              </button>
              <button type="button" class="tree-mini-btn" data-tree-action="del-pos" data-id="${a.id}" data-list="cons" data-pos="${pos.id}" title="Удалить позицию" aria-label="Удалить позицию">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
              </button>
            </span>
          </div>
        `);
        }
      }

      p.push(`</details>`);
    }

    p.push(`
    <div class="tree-item tree-item-with-actions ${this._selected(sel, { type: "projlist" }) ? "is-selected" : ""}" data-node="projlist">
      <span class="tree-item-label">Расходники</span>
      <span class="tree-item-actions">
        <button type="button" class="tree-mini-btn has-indicator" data-tree-action="toggle-proj" title="${this._app.state.hasProjectConsumables ? "Выключить лист расходников" : "Включить лист расходников"}" aria-label="${this._app.state.hasProjectConsumables ? "Выключить лист расходников" : "Включить лист расходников"}">
          <span class="tree-mini-indicator ${this._app.state.hasProjectConsumables ? "is-on" : "is-off"}" aria-hidden="true"></span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v7m5-5a7 7 0 1 1-10 0" /></svg>
        </button>
        <button type="button" class="tree-mini-btn" data-tree-action="add-proj-pos" title="Добавить позицию" aria-label="Добавить позицию" ${this._app.state.hasProjectConsumables ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10M17 15v6M14 18h6" /></svg>
        </button>
      </span>
    </div>
  `);
    if (this._app.state.hasProjectConsumables) {
      for (const pos of this._app.state.projectConsumables) {
        p.push(`
        <div class="tree-item tree-item-with-actions small ${this._selected(sel, { type: "projpos", pos: pos.id }) ? "is-selected" : ""}" style="padding-left:18px" data-node="projpos" data-pos="${pos.id}">
          <span class="tree-item-label">• ${this._esc(pos.name || "Позиция")}</span>
          <span class="tree-item-actions">
            <button type="button" class="tree-mini-btn" data-tree-action="dup-pos" data-id="project" data-list="project" data-pos="${pos.id}" title="Дублировать позицию" aria-label="Дублировать позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v10H9zM5 5h10v10" /></svg>
            </button>
            <button type="button" class="tree-mini-btn" data-tree-action="del-pos" data-id="project" data-list="project" data-pos="${pos.id}" title="Удалить позицию" aria-label="Удалить позицию">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
            </button>
          </span>
        </div>
      `);
      }
    }

    this._dom.tree.innerHTML = p.join("");
  }

  renderInspector() {
    const s = this._app.ui.treeSel;
    if (s.type === "settings") {
      this._renderSettingsInspector();
      return;
    }

    if (s.type === "assembly") {
      const a = this._projectMutationApi.findAssemblyById(this._app.state, s.id);
      if (!a) return;
      this._renderAssemblyInspector(a);
      return;
    }

    if (s.type === "list") {
      this._dom.inspector.innerHTML = `<h3>${s.list === "main" ? "Основные материалы" : "Расходные материалы"}</h3>`;
      return;
    }

    if (s.type === "pos") {
      const a = this._projectMutationApi.findAssemblyById(this._app.state, s.id);
      if (!a) return;
      const list = s.list === "main" ? a.main : a.consumable;
      const p = list.find((x) => x.id === s.pos);
      if (!p) return;
      this._renderPositionInspector(p, s.id, s.list);
      return;
    }

    if (s.type === "projlist") {
      this._dom.inspector.innerHTML = "<h3>Расходники</h3>";
      return;
    }

    if (s.type === "projpos") {
      const p = this._app.state.projectConsumables.find((x) => x.id === s.pos);
      if (!p) return;
      this._renderPositionInspector(p, "project", "project");
      return;
    }

    this._dom.inspector.innerHTML = "";
  }

  _selected(curr, expected) {
    if (!curr || curr.type !== expected.type) return false;
    for (const [k, v] of Object.entries(expected)) {
      if (k !== "type" && curr[k] !== v) return false;
    }
    return true;
  }

  _renderSettingsInspector() {
    const s = this._app.state.settings;
    this._dom.inspector.innerHTML = `
    <h3>Общие настройки</h3>
    <div class="grid">
      <label>Номер заказа<input data-role="setting" data-field="orderNumber" value="${this._esc(s.orderNumber)}" /></label>
      <label>Номер запроса<input data-role="setting" data-field="requestNumber" value="${this._esc(s.requestNumber)}" /></label>
      <label>Дата изменения<input data-role="setting" data-field="changeDate" type="date" value="${this._esc(s.changeDate)}" /></label>
      <label>Версия<input data-role="setting" data-field="version" value="${this._esc(s.version)}" placeholder="1234" /></label>
      <label>НДС, %<input data-role="setting" data-field="vatRate" type="number" step="0.01" value="${this._projectStateApi.decToPct(s.vatRate)}" /></label>
      <label>Итоговая цена<select data-role="setting" data-field="totalMode"><option value="withoutDiscount" ${s.totalMode === "withoutDiscount" ? "selected" : ""}>Без скидки</option><option value="withDiscount" ${s.totalMode === "withDiscount" ? "selected" : ""}>Со скидкой</option></select></label>
    </div>`;
  }

  _renderAssemblyInspector(a) {
    const m = this._workbookApi.calcAssemblyMetrics(a, this._app.state.settings.vatRate);
    this._dom.inspector.innerHTML = `
    <h3>Параметры сборки</h3>
    <div class="grid">
      <label>Полное название<input data-role="assembly" data-id="${a.id}" data-field="fullName" value="${this._esc(a.fullName)}" /></label>
      <label>Аббревиатура<input data-role="assembly" data-id="${a.id}" data-field="abbreviation" value="${this._esc(a.abbreviation)}" /></label>
      <label class="check-line"><input data-role="assembly" data-id="${a.id}" data-field="abbrManual" type="checkbox" ${a.abbrManual ? "checked" : ""} /> Ручная аббревиатура</label>
      <label class="check-line"><input data-role="assembly" data-id="${a.id}" data-field="separateConsumables" type="checkbox" ${a.separateConsumables ? "checked" : ""} /> Отдельный лист расходных материалов</label>
      ${a.separateConsumables ? "" : `<label>Расх. материал без скидки<input data-role="assembly" data-id="${a.id}" data-field="manualConsNoDisc" type="number" step="0.01" value="${a.manualConsNoDisc}" /></label><label>Расх. материал со скидкой<input data-role="assembly" data-id="${a.id}" data-field="manualConsDisc" type="number" step="0.01" value="${a.manualConsDisc}" /></label>`}
      <div class="meta">Разработка схемы</div>
      <div class="row"><label>Коэфф.<input data-role="labor" data-id="${a.id}" data-field="devCoeff" type="number" step="0.01" value="${a.labor.devCoeff}" /></label><label>Часы<input data-role="labor" data-id="${a.id}" data-field="devHours" type="number" step="0.1" value="${a.labor.devHours}" /></label></div>
      <label>Ставка<input data-role="labor" data-id="${a.id}" data-field="devRate" type="number" step="0.01" value="${a.labor.devRate}" /></label>
      <div class="meta">Работа по сборке</div>
      <div class="row"><label>Коэфф.<input data-role="labor" data-id="${a.id}" data-field="assmCoeff" type="number" step="0.01" value="${a.labor.assmCoeff}" /></label><label>Часы<input data-role="labor" data-id="${a.id}" data-field="assmHours" type="number" step="0.1" value="${a.labor.assmHours}" /></label></div>
      <label>Ставка<input data-role="labor" data-id="${a.id}" data-field="assmRate" type="number" step="0.01" value="${a.labor.assmRate}" /></label>
      <label>Прибыль (0.3 = 30%)<input data-role="labor" data-id="${a.id}" data-field="profitCoeff" type="number" step="0.01" value="${a.labor.profitCoeff}" /></label>
      <div class="meta">Итог без скидки: <strong>${this._money(m.totalNoDisc)}</strong><br/>Итог со скидкой: <strong>${this._money(m.totalDisc)}</strong></div>
    </div>`;
  }

  _renderPositionInspector(p, id, list) {
    const role = list === "project" ? "project-pos" : "pos";
    this._dom.inspector.innerHTML = `
    <h3>Позиция</h3>
    <div class="grid">
      <label>Обозначение<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="schematic" value="${this._esc(p.schematic)}" /></label>
      <label>Наименование<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="name" value="${this._esc(p.name)}" /></label>
      <label>Производитель<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="manufacturer" value="${this._esc(p.manufacturer)}" /></label>
      <label>Артикул<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="article" value="${this._esc(p.article)}" /></label>
      <div class="row"><label>Кол-во<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="qty" type="number" step="0.01" value="${p.qty}" /></label><label>Ед. изм.<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="unit" value="${this._esc(p.unit)}" /></label></div>
      <label>Цена без скидки, с наценкой и с НДС<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="priceCatalogVatMarkup" type="number" step="0.01" value="${p.priceCatalogVatMarkup}" /></label>
      <div class="row"><label>Наценка, %<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="markup" type="number" step="0.01" value="${this._projectStateApi.decToPct(p.markup)}" /></label><label>Скидка, %<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="discount" type="number" step="0.01" value="${this._projectStateApi.decToPct(p.discount)}" /></label></div>
      <label>Поставщик<input data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="supplier" value="${this._esc(p.supplier)}" /></label>
      <label>Примечание<textarea data-role="${role}" data-id="${id}" data-list="${list}" data-pos="${p.id}" data-field="note">${this._esc(p.note)}</textarea></label>
    </div>`;
  }
}
