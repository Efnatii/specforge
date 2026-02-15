export class AgentStateToolsModule {
  constructor(ctx) {
    this._facade = createAgentStateToolsInternal(ctx);
    this.tryExecute = this.tryExecute.bind(this);
  }

  async tryExecute(name, args, turnCtx = null) {
    return this._facade.tryExecute(name, args, turnCtx);
  }
}

function createAgentStateToolsInternal(ctx) {
  const { app, deps } = ctx || {};
  if (!app) throw new Error("AgentStateToolsModule requires app");
  if (!deps) throw new Error("AgentStateToolsModule requires deps");

  const {
    marketVerificationModule,
    gridApi,
    stateAccessApi,
    addTableJournal,
    addChangesJournal,
    renderAll,
    num,
    normalizePercentDecimal,
  } = deps;

  if (!marketVerificationModule) throw new Error("AgentStateToolsModule requires marketVerificationModule");
  if (!gridApi) throw new Error("AgentStateToolsModule requires gridApi");
  if (!stateAccessApi) throw new Error("AgentStateToolsModule requires stateAccessApi");
  if (typeof addTableJournal !== "function") throw new Error("AgentStateToolsModule requires addTableJournal()");
  if (typeof addChangesJournal !== "function") throw new Error("AgentStateToolsModule requires addChangesJournal()");
  if (typeof renderAll !== "function") throw new Error("AgentStateToolsModule requires renderAll()");
  if (typeof num !== "function") throw new Error("AgentStateToolsModule requires num()");
  if (typeof normalizePercentDecimal !== "function") throw new Error("AgentStateToolsModule requires normalizePercentDecimal()");

  if (typeof gridApi.compactForTool !== "function") throw new Error("AgentStateToolsModule requires gridApi.compactForTool()");
  if (typeof stateAccessApi.getStatePath !== "function") throw new Error("AgentStateToolsModule requires stateAccessApi.getStatePath()");
  if (typeof stateAccessApi.statePathExists !== "function") throw new Error("AgentStateToolsModule requires stateAccessApi.statePathExists()");
  if (typeof stateAccessApi.setStatePath !== "function") throw new Error("AgentStateToolsModule requires stateAccessApi.setStatePath()");

  const compactForTool = (...args) => gridApi.compactForTool(...args);
  const getStatePath = (...args) => stateAccessApi.getStatePath(...args);
  const statePathExists = (...args) => stateAccessApi.statePathExists(...args);
  const setStatePath = (...args) => stateAccessApi.setStatePath(...args);

  function parseJsonValue(raw) {
    if (typeof raw !== "string") return raw;
    const txt = raw.trim();
    if (!txt) return "";
    try {
      return JSON.parse(txt);
    } catch {
      return raw;
    }
  }

  function normalizeQuestionOption(textRaw) {
    let text = String(textRaw || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    text = text.replace(/^[:\-–—.,;)\]]+\s*/, "").trim();
    text = text.replace(/^[(\[]+/, "").trim();
    text = text.replace(/^["'«»]+/, "").trim();
    text = text.replace(/["'«»]+$/, "").trim();
    text = text.replace(/[;,.]+$/, "").trim();
    if (!text) return "";
    if (text.length < 2 || text.length > 140) return "";
    if (/^предложить\s+свой$/i.test(text)) return "";
    if (/^(вариант|варианты|option|options)$/i.test(text)) return "";
    return text;
  }

  function normalizeQuestionPayload(args) {
    const question = String(args?.question || "").replace(/\s+/g, " ").trim().slice(0, 320);
    const optionsInput = args?.options;
    let options = [];

    if (optionsInput !== undefined && !Array.isArray(optionsInput)) {
      return { error: "options must be an array of strings (2..6) or omitted" };
    }

    const optionsRaw = Array.isArray(optionsInput) ? optionsInput : [];
    const seen = new Set();
    for (const item of optionsRaw) {
      const option = normalizeQuestionOption(item);
      if (!option) continue;
      const key = option.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(option);
      if (options.length >= 6) break;
    }

    if (Array.isArray(optionsInput) && options.length < 2) {
      return { error: "options must contain at least 2 valid items or be omitted" };
    }

    const allowCustom = args?.allow_custom === undefined
      ? options.length === 0
      : Boolean(args?.allow_custom);
    return { question, options, allow_custom: allowCustom };
  }

  async function tryExecute(name, args, turnCtx = null) {
    if (name === "ask_user_question") {
      const allowQuestions = app?.ai?.options?.allowQuestions !== false;
      if (!allowQuestions) {
        addTableJournal("ask_user_question", "Ошибка: вопросы пользователю запрещены настройкой");
        return { ok: false, applied: 0, error: "questions are disabled (allowQuestions=off)" };
      }

      const payload = normalizeQuestionPayload(args);
      if (payload?.error) {
        addTableJournal("ask_user_question", `Ошибка: ${payload.error}`);
        return { ok: false, applied: 0, error: payload.error };
      }
      if (!payload.question) {
        addTableJournal("ask_user_question", "Ошибка: пустой question");
        return { ok: false, applied: 0, error: "question required" };
      }

      app.ai.pendingQuestion = {
        turn_id: String(app.ai.turnId || ""),
        text: payload.question,
        options: payload.options,
        allow_custom: payload.allow_custom,
      };

      addTableJournal("ask_user_question", `Вопрос пользователю: ${payload.question}`);
      addChangesJournal("ai.task.question", `turn=${app.ai.turnId || ""}`, {
        turn_id: app.ai.turnId || "",
        status: "completed",
        meta: {
          via: "tool",
          question: payload.question,
          options_count: payload.options.length,
          allow_custom: payload.allow_custom,
        },
      });
      return {
        ok: true,
        applied: 0,
        awaiting_user_input: true,
        question: app.ai.pendingQuestion,
        message: "Нужно уточнение от пользователя. Ответьте в блоке вопроса.",
      };
    }

    if (name === "read_settings") {
      const settings = {
        order_number: app.state.settings.orderNumber,
        request_number: app.state.settings.requestNumber,
        change_date: app.state.settings.changeDate,
        version: app.state.settings.version,
        vat_rate: num(app.state.settings.vatRate, 0),
        total_mode: app.state.settings.totalMode,
      };
      addTableJournal("read_settings", "Прочитаны общие настройки");
      return { ok: true, applied: 0, entity: { type: "settings" }, warnings: [], settings };
    }

    if (name === "update_settings") {
      const changed = [];
      if (args?.order_number !== undefined) {
        app.state.settings.orderNumber = String(args.order_number || "").trim();
        changed.push("order_number");
      }
      if (args?.request_number !== undefined) {
        app.state.settings.requestNumber = String(args.request_number || "").trim();
        changed.push("request_number");
      }
      if (args?.change_date !== undefined) {
        app.state.settings.changeDate = String(args.change_date || "").trim();
        changed.push("change_date");
      }
      if (args?.version !== undefined) {
        app.state.settings.version = String(args.version || "").trim();
        changed.push("version");
      }
      if (args?.vat_rate !== undefined) {
        app.state.settings.vatRate = normalizePercentDecimal(args.vat_rate);
        changed.push("vat_rate");
      }
      if (args?.total_mode !== undefined) {
        app.state.settings.totalMode = String(args.total_mode || "").trim() === "withDiscount" ? "withDiscount" : "withoutDiscount";
        changed.push("total_mode");
      }
      if (!changed.length) {
        addTableJournal("update_settings", "Ошибка: нет полей для изменения");
        return { ok: false, applied: 0, entity: { type: "settings" }, warnings: [], error: "no fields to update" };
      }
      renderAll();
      addTableJournal("update_settings", `Обновлены поля: ${changed.join(", ")}`);
      addChangesJournal("settings.update", changed.join(", "));
      return { ok: true, applied: 1, entity: { type: "settings" }, warnings: [], changed };
    }

    if (name === "get_state") {
      const value = args?.path ? getStatePath(args.path) : app.state;
      addTableJournal("get_state", args?.path ? `Чтение пути ${args.path}` : "Чтение полного state");
      return { ok: true, path: args?.path || "", value: compactForTool(value) };
    }

    if (name === "set_state_value") {
      if (!args?.path) {
        addTableJournal("set_state_value", "Ошибка: path required");
        return { ok: false, error: "path required" };
      }
      if (!statePathExists(args.path)) {
        addTableJournal("set_state_value", `Ошибка: path not found (${args.path})`);
        return { ok: false, error: "path not found" };
      }
      if (marketVerificationModule.statePathRequiresMarketVerification(args.path)) {
        const verified = marketVerificationModule.ensureMarketVerification(turnCtx, args?.verification, "set_state_value");
        if (!verified.ok) return { ok: false, error: verified.error };
      }
      const nextValue = args?.value_json !== undefined ? parseJsonValue(args.value_json) : args?.value;
      try {
        const prevValue = getStatePath(args.path);
        setStatePath(args.path, nextValue);
        renderAll();
        addTableJournal("set_state_value", `Изменен путь ${args.path}`);
        addChangesJournal("ai.set_state", args.path);
        return { ok: true, changed: !Object.is(prevValue, nextValue) };
      } catch (err) {
        addTableJournal("set_state_value", `Ошибка: ${String(err?.message || err)}`);
        return { ok: false, error: String(err?.message || err) };
      }
    }

    return undefined;
  }

  return { tryExecute };
}
