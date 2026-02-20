export class AgentRuntimeSystemPromptModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimeSystemPromptInternal(ctx));
  }
}

function createAgentRuntimeSystemPromptInternal(ctx) {
  const app = ctx?.app || null;
  const normalizeEnum = (value, allowed, fallback) => {
    const raw = String(value || "").trim().toLowerCase();
    if (allowed.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return allowed.includes(fb) ? fb : allowed[0];
  };

  function getRuntimeAwareOption(key, fallback = undefined) {
    const runtimeOverrides = app?.ai?.runtimeProfile?.overrides;
    if (runtimeOverrides && Object.prototype.hasOwnProperty.call(runtimeOverrides, key)) {
      return runtimeOverrides[key];
    }
    const value = app?.ai?.options?.[key];
    return value === undefined ? fallback : value;
  }

  function resolveRuntimeTaskProfileInfo() {
    const runtime = app?.ai?.runtimeProfile || null;
    const taskModeRaw = String(app?.ai?.options?.taskProfile || "auto").trim().toLowerCase();
    const runtimeModeRaw = String(runtime?.mode || "").trim().toLowerCase();
    const runtimeMode = runtimeModeRaw === "auto"
      || runtimeModeRaw === "balanced"
      || runtimeModeRaw === "proposal"
      || runtimeModeRaw === "price_search"
      || runtimeModeRaw === "source_audit"
      || runtimeModeRaw === "spec_strict"
      || runtimeModeRaw === "bulk"
      || runtimeModeRaw === "accurate"
      || runtimeModeRaw === "research"
      || runtimeModeRaw === "longrun"
      || runtimeModeRaw === "fast"
      || runtimeModeRaw === "custom"
      || runtimeModeRaw === "no_reasoning"
      || runtimeModeRaw === "no_reasoning_custom"
      ? runtimeModeRaw
      : "";
    const taskMode = taskModeRaw === "auto"
      || taskModeRaw === "balanced"
      || taskModeRaw === "proposal"
      || taskModeRaw === "price_search"
      || taskModeRaw === "source_audit"
      || taskModeRaw === "spec_strict"
      || taskModeRaw === "bulk"
      || taskModeRaw === "accurate"
      || taskModeRaw === "research"
      || taskModeRaw === "longrun"
      || taskModeRaw === "fast"
      || taskModeRaw === "custom"
      ? taskModeRaw
      : "auto";
    const noReasoningAliases = {
      auto: "standard",
      fast: "quick",
      balanced: "standard",
      bulk: "concise",
      longrun: "detailed",
      price_search: "sources",
      proposal: "json",
      source_audit: "sources",
      accurate: "cautious",
      research: "sources",
      spec_strict: "json",
    };
    const noReasoningSelectedRaw = String(app?.ai?.options?.noReasoningProfile || "standard").trim().toLowerCase();
    const noReasoningSelectedMapped = noReasoningAliases[noReasoningSelectedRaw] || noReasoningSelectedRaw;
    const noReasoningSelected = normalizeEnum(
      noReasoningSelectedMapped,
      ["quick", "standard", "concise", "detailed", "json", "sources", "cautious", "tool_free", "custom"],
      "standard",
    );
    const reasoningOff = app?.ai?.options?.reasoning === false;
    let mode = "";
    if (reasoningOff) {
      mode = runtimeMode === "no_reasoning" || runtimeMode === "no_reasoning_custom"
        ? runtimeMode
        : (noReasoningSelected === "custom" ? "no_reasoning_custom" : "no_reasoning");
    } else {
      mode = runtimeMode || taskMode;
    }
    const noReasoningMode = mode === "no_reasoning" || mode === "no_reasoning_custom";
    const runtimeSelectedRaw = String(runtime?.selected || "").trim().toLowerCase();
    const runtimeSelectedNoReasoning = noReasoningAliases[runtimeSelectedRaw] || runtimeSelectedRaw;
    const taskSelectedAllowed = new Set([
      "balanced",
      "proposal",
      "price_search",
      "source_audit",
      "spec_strict",
      "bulk",
      "accurate",
      "research",
      "longrun",
      "fast",
      "custom",
    ]);
    const noReasoningSelectedAllowed = new Set([
      "quick",
      "standard",
      "concise",
      "detailed",
      "json",
      "sources",
      "cautious",
      "tool_free",
      "custom",
    ]);
    const runtimeSelectedTask = taskSelectedAllowed.has(runtimeSelectedRaw) ? runtimeSelectedRaw : "";
    const runtimeSelectedNoReasoningSafe = noReasoningSelectedAllowed.has(runtimeSelectedNoReasoning) ? runtimeSelectedNoReasoning : "";
    const runtimeSelectedByMode = noReasoningMode ? runtimeSelectedNoReasoningSafe : runtimeSelectedTask;
    const selectedFallback = noReasoningMode
      ? noReasoningSelected
      : (mode === "auto" ? "balanced" : mode);
    const selected = normalizeEnum(
      runtimeSelectedByMode || selectedFallback,
      [
        "balanced",
        "proposal",
        "price_search",
        "source_audit",
        "spec_strict",
        "bulk",
        "accurate",
        "research",
        "longrun",
        "fast",
        "custom",
        "quick",
        "standard",
        "concise",
        "detailed",
        "json",
        "sources",
        "cautious",
        "tool_free",
      ],
      noReasoningMode ? "standard" : "balanced",
    );
    const defaultReason = mode === "no_reasoning_custom"
      ? "manual_no_reasoning_custom"
      : noReasoningMode
        ? "manual_no_reasoning_profile"
        : mode === "auto"
          ? "auto_default"
          : "manual_profile";
    const reasonRaw = String(runtime?.reason || defaultReason).trim();
    const reason = reasonRaw || defaultReason;
    return { mode, selected, reason };
  }

  function buildRuntimeProfileInstructions() {
    const profileInfo = resolveRuntimeTaskProfileInfo();
    const serviceTier = normalizeEnum(getRuntimeAwareOption("serviceTier", "standard"), ["flex", "standard", "priority"], "standard");
    const depth = normalizeEnum(getRuntimeAwareOption("reasoningDepth", "balanced"), ["fast", "balanced", "deep"], "balanced");
    const verify = normalizeEnum(getRuntimeAwareOption("reasoningVerify", "basic"), ["off", "basic", "strict"], "basic");
    const summaryMode = normalizeEnum(getRuntimeAwareOption("reasoningSummary", "auto"), ["off", "auto", "concise", "detailed"], "auto");
    const clarify = normalizeEnum(getRuntimeAwareOption("reasoningClarify", "never"), ["never", "minimal", "normal"], "never");
    const toolsMode = normalizeEnum(getRuntimeAwareOption("toolsMode", "auto"), ["none", "auto", "prefer", "require"], "auto");
    const brevity = normalizeEnum(getRuntimeAwareOption("brevityMode", "normal"), ["short", "normal", "detailed"], "normal");
    const output = normalizeEnum(getRuntimeAwareOption("outputMode", "bullets"), ["plain", "bullets", "json"], "bullets");
    const riskyActions = normalizeEnum(getRuntimeAwareOption("riskyActionsMode", "allow_if_asked"), ["confirm", "allow_if_asked", "never"], "allow_if_asked");
    const style = normalizeEnum(getRuntimeAwareOption("styleMode", "clean"), ["clean", "verbose"], "clean");
    const citations = normalizeEnum(getRuntimeAwareOption("citationsMode", "off"), ["off", "on"], "off");
    const reasoningMaxTokensRaw = Number(getRuntimeAwareOption("reasoningMaxTokens", 0));
    const reasoningMaxTokens = Number.isFinite(reasoningMaxTokensRaw) && reasoningMaxTokensRaw > 0
      ? Math.max(1, Math.round(reasoningMaxTokensRaw))
      : 0;

    const lines = [];
    lines.push(`Task profile: MODE=${profileInfo.mode}; SELECTED=${profileInfo.selected}; REASON=${profileInfo.reason}.`);
    lines.push(`Runtime profile: SERVICE_TIER=${serviceTier}; DEPTH=${depth}; VERIFY=${verify}; SUMMARY=${summaryMode}; CLARIFY=${clarify}; TOOLS=${toolsMode}; BREVITY=${brevity}; OUTPUT=${output}; RISKY_ACTIONS=${riskyActions}; STYLE=${style}; CITATIONS=${citations}; REASONING_TOKENS=${reasoningMaxTokens > 0 ? reasoningMaxTokens : "auto"}.`);

    if (depth === "fast") lines.push("Depth policy: return quickly, minimal branching and short internal analysis.");
    else if (depth === "deep") lines.push("Depth policy: perform deeper analysis, compare alternatives, and do extra self-checks before the final answer.");
    else lines.push("Depth policy: balanced depth with one internal verification pass by default.");

    if (verify === "off") lines.push("Verification policy: skip explicit self-check unless safety requires it.");
    else if (verify === "strict") lines.push("Verification policy: run a strict checklist, contradiction scan, and edge-case pass before finalizing.");
    else lines.push("Verification policy: do a short sanity check for logic and obvious mistakes.");

    if (summaryMode === "off") lines.push("Reasoning summary policy: do not request reasoning summaries.");
    else if (summaryMode === "concise") lines.push("Reasoning summary policy: prefer concise reasoning summaries.");
    else if (summaryMode === "detailed") lines.push("Reasoning summary policy: prefer detailed reasoning summaries.");
    else lines.push("Reasoning summary policy: use automatic reasoning summary level.");

    if (clarify === "never") lines.push("Clarification policy: never ask follow-up questions; proceed with explicit assumptions.");
    else if (clarify === "normal") lines.push("Clarification policy: ask when uncertainty can materially affect correctness.");
    else lines.push("Clarification policy: ask only when risk of error is high without clarification.");

    if (toolsMode === "none") lines.push("Tools policy: do not use tools; provide a direct answer and clearly note assumptions/limits.");
    else if (toolsMode === "require") lines.push("Tools policy: prefer tool-backed results; do not guess facts if tools or user data are needed.");
    else if (toolsMode === "prefer") lines.push("Tools policy: prefer tool usage for verification when uncertain.");
    else lines.push("Tools policy: use tools only when needed.");
    if (toolsMode !== "none") {
      lines.push("Agent focus: prioritize spreadsheet tools, web_search, file_search, and computer_use when needed.");
    }

    if (riskyActions === "confirm") lines.push("Risk policy: ask for explicit confirmation before risky or irreversible actions.");
    else if (riskyActions === "allow_if_asked") lines.push("Risk policy: perform risky actions only when the user explicitly requested them.");
    else lines.push("Risk policy: do not ask user questions; proceed with explicit assumptions and avoid irreversible risk where possible.");

    if (output === "json") lines.push("Output policy: final response must be valid JSON only.");
    else if (output === "plain") lines.push("Output policy: use plain text without bullet formatting.");
    else lines.push("Output policy: use concise bullet points.");

    if (brevity === "short") lines.push("Brevity policy: keep output very short.");
    else if (brevity === "detailed") lines.push("Brevity policy: provide detailed steps and rationale.");
    else lines.push("Brevity policy: keep a balanced level of detail.");

    if (style === "clean") lines.push("Style policy: dry and direct language with minimal filler.");
    else lines.push("Style policy: provide expanded explanations and context.");

    if (citations === "on") lines.push("Citation policy: if web_search was used, cite key source URLs in the final answer.");
    else lines.push("Citation policy: source URLs are optional.");

    return lines.join(" ");
  }

  function buildElectricalBomInstructions() {
    const lines = [];
    lines.push("Electrical BOM mode: apply these rules when the task is about electrical switchboards, BOM/specification, breakers, RCD/RCBO, contactors, relays, busbars, terminals, enclosure IP, or cabinet equipment.");
    lines.push("If the task is unrelated to electrical equipment specification, ignore this mode.");
    lines.push("Priority order is strict: (1) safety and compatibility, (2) user requirements/brands/suppliers, (3) optimization/unification/cost.");
    lines.push("Never invent SKUs/articles, prices, stock, exact dimensions, short-circuit currents, or exact technical characteristics.");
    lines.push("Do not cite exact clause numbers from standards unless the user provided the source text/link; if not provided, state only generic normative requirement.");
    lines.push("Do not replace a specification task with plain narrative: always return a BOM table, even when preliminary.");
    lines.push("If required data is missing, state НЕТ ДАННЫХ, keep status preliminary, and add a concrete missing-data request list.");
    lines.push("Do not expose full internal reasoning; show only result tables, short technical rationale for disputed choices, and risks/questions/assumptions.");
    lines.push("Use deterministic workflow: parse and normalize units -> classify feeders -> select protection -> check accessories compatibility -> complete cabinet composition -> unify -> deduplicate -> final validation.");
    lines.push("Protection selection rules: choose In with safe margin versus design current; require Icu/Ics >= Ikz at installation point; require Ue/Ui and pole count compatibility. If Ikz is missing, do not finalize breaking capacity.");
    lines.push("Accessory rules: accessory series/frame/voltage must match base device exactly. Cross-series mismatch is prohibited.");
    lines.push("Cabinet completeness check: include enclosure/mounting/DIN, N/PE bars, busbar holders, terminals, wiring accessories, marking, cable entry hardware, and required consumables where relevant.");
    lines.push("Data provenance is mandatory per position: Source and Confidence (HIGH/MEDIUM/LOW). LOW confidence must be listed in risks.");
    lines.push("If user provided source rows, keep Ref traceability; replacements must be marked REPLACED with short reason.");
    lines.push("If assumptions are unavoidable: prefix with ПРЕДПОЛОЖЕНИЕ, set Confidence=LOW, keep assumptions minimal and safe; never assume SKU/article.");
    lines.push("If requirements conflict, provide Variant A and Variant B with trade-offs and explicitly ask user to choose.");
    lines.push("Before final answer, run mandatory checks and report status: OK / НЕТ ДАННЫХ / ПРОБЛЕМА for each check.");
    lines.push("Mandatory checks: Icu/Ics vs Ikz, network pole/neutral compatibility, coil/release voltage compatibility, accessory frame compatibility, N/PE and terminal sufficiency, duplicate consolidation, and listing all НЕИЗВЕСТНО items in risks.");
    lines.push("For electrical BOM tasks, output format must be strict and copyable to Excel:");
    lines.push("Section 1: brief summary (3-7 lines).");
    lines.push("Section 2: main BOM table in TSV with exact column order:");
    lines.push("№	Группа	Наименование	Производитель	Серия/Модель	Артикул	Кол-во	Ед.	Ключевые параметры	Примечание	Источник	Уверенность	Ref");
    lines.push("Section 3: validation checks and warnings. If any critical issue exists, print STOP: требуется уточнение.");
    lines.push("Section 4: missing data requests with why each is needed.");
    lines.push("For unknown article use НЕИЗВЕСТНО. Units: шт, м, компл.");
    lines.push("Allowed group dictionary: Корпус; Ввод; Секционирование; Отходящие линии; АВР; Управление/Релейка; Шины; Клеммы; Монтаж; Маркировка; Расходники; Документация.");
    return lines.join(" ");
  }

  function agentSystemPrompt() {
    const clarifyMode = normalizeEnum(getRuntimeAwareOption("reasoningClarify", "never"), ["never", "minimal", "normal"], "never");
    const riskyMode = normalizeEnum(getRuntimeAwareOption("riskyActionsMode", "allow_if_asked"), ["confirm", "allow_if_asked", "never"], "allow_if_asked");
    const toolsMode = normalizeEnum(getRuntimeAwareOption("toolsMode", "auto"), ["none", "auto", "prefer", "require"], "auto");
    const allowQuestions = clarifyMode !== "never" && riskyMode !== "never" && toolsMode !== "none";
    const selectedRangeInstruction = "If the user asks about selected cells or a highlighted range, call get_selection first and use its result.";
    const attachmentInstruction = "If attached files exist, use file_search first. For exact excerpts, call list_attachments and read_attachment.";
    const runtimeProfileInstruction = buildRuntimeProfileInstructions();
    const electricalBomInstruction = buildElectricalBomInstructions();
    return [
      "Ты AI-агент внутри SpecForge.",
      "Ты можешь читать и изменять таблицы и состояние проекта через tools. Для таблиц используй list_sheets, set_active_sheet, read_range, find_cells, write_cells, write_matrix, copy_range, fill_range, replace_in_range, clear_range, clear_sheet_overrides, get_selection.",
      "Для операций со сборками и позициями используй специализированные tools: create_assembly, update_assembly, delete_assembly, duplicate_assembly, bulk_delete_assemblies, add_position, update_position, delete_position, duplicate_position, move_position, add_project_position, update_project_position, delete_project_position, list_project_positions, read_position, resolve_target_context.",
      "Если пользователь просит удалить все сборки, вызывай bulk_delete_assemblies со scope=all.",
      "Строго запрещено выдумывать позиции и любые их поля. Поля позиции: schematic, name, manufacturer, article, qty, unit, price_catalog_vat_markup, markup, discount, supplier, note.",
      "Перед add_position/update_position/add_project_position/update_project_position обязательно передай verification.",
      "Verification допустим только двумя способами: web_search (query + минимум 2 валидных URL) или подтверждение через прикрепленные документы (attachments).",
      "Для подтверждения через документы в verification.attachments укажи name или id прикрепленного файла.",
      "Если подтверждения нет ни по web, ни по документам, сообщи об этом и не добавляй/не обновляй позицию.",
      "Не заполняй отсутствующие данные догадками. Если по полю нет подтверждения источниками, оставь поле пустым или не меняй его.",
      "Для цен, поставщика, производителя и артикула используй только значения, которые явно подтверждены источниками.",
      "В note каждой созданной/обновленной рыночной позиции добавляй короткий комментарий в 1-2 строки: почему выбрана позиция и как выполнена верификация (web URL или attachment).",
      "Комментарий должен быть максимально кратким, но содержательным. Длинный note допустим: столбец комментария можно расширять по горизонтали.",
      "Для set_state_value передавай поле value_json как валидную JSON-строку.",
      "Политику подтверждения рискованных действий определяй по Runtime profile (RISKY_ACTIONS).",
      "Если пользователь просит выполнить изменение, выполняй через tools в этом же ходе; для рискованных/необратимых действий действуй по Runtime profile (RISKY_ACTIONS).",
      "Если данных недостаточно, не выдумывай типовой вариант: зафиксируй ограничение и продолжай остальные шаги.",
      allowQuestions
        ? "Если без уточнения нельзя корректно продолжить, задай вопрос ТОЛЬКО через tool ask_user_question. В обычном тексте не пиши вопрос, варианты и служебные пояснения. Варианты ответа необязательны: если не уверен в вариантах или они не нужны, отправляй только question и allow_custom=true."
        : "Запрещено задавать вопросы пользователю и вызывать ask_user_question. Это определяется настройками: Риски=Никогда или Уточнения=Никогда. При нехватке данных выбирай наиболее безопасный вариант и продолжай, явно фиксируя допущение.",
      "Не проси пользователя написать \"продолжай\" и не откладывай выполнение на следующий ход.",
      "Если шаги независимы, группируй несколько tool-вызовов в одном ответе, чтобы сократить число раундов.",
      "Если assembly_id не найден, определи целевую сборку по текущему контексту и продолжай.",
      "Никогда не утверждай, что изменение применено, если tool вернул ok=false или applied=0.",
      "Структуру и подробность финального ответа выбирай по Runtime profile (BREVITY, OUTPUT, STYLE).",
      "Не выводи JSON вызовов tools в тексте ответа.",
      "Перед изменениями проверяй целевые листы/диапазоны.",
      "При изменениях кратко подтверждай, что именно поменял.",
      "Если задачу можно доделать автоматически, доделывай до конца в текущем ходе.",
      selectedRangeInstruction,
      attachmentInstruction,
      runtimeProfileInstruction,
      electricalBomInstruction,
    ].join(" ");
  }

  return { agentSystemPrompt };
}
