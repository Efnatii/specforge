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

  function buildRuntimeProfileInstructions() {
    const options = app?.ai?.options || {};
    const serviceTier = normalizeEnum(options.serviceTier, ["flex", "standard", "priority"], "standard");
    const depth = normalizeEnum(options.reasoningDepth, ["fast", "balanced", "deep"], "balanced");
    const verify = normalizeEnum(options.reasoningVerify, ["off", "basic", "strict"], "basic");
    const summaryMode = normalizeEnum(options.reasoningSummary, ["off", "auto", "concise", "detailed"], "auto");
    const clarify = normalizeEnum(options.reasoningClarify, ["never", "minimal", "normal"], "minimal");
    const toolsMode = normalizeEnum(options.toolsMode, ["none", "auto", "prefer", "require"], "auto");
    const brevity = normalizeEnum(options.brevityMode, ["short", "normal", "detailed"], "normal");
    const output = normalizeEnum(options.outputMode, ["plain", "bullets", "json"], "bullets");
    const riskyActions = normalizeEnum(options.riskyActionsMode, ["confirm", "allow_if_asked", "never"], "confirm");
    const style = normalizeEnum(options.styleMode, ["clean", "verbose"], "clean");
    const citations = normalizeEnum(options.citationsMode, ["off", "on"], "off");
    const reasoningMaxTokensRaw = Number(options.reasoningMaxTokens);
    const reasoningMaxTokens = Number.isFinite(reasoningMaxTokensRaw) && reasoningMaxTokensRaw > 0
      ? Math.max(1, Math.round(reasoningMaxTokensRaw))
      : 0;

    const lines = [];
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

  function agentSystemPrompt() {
    const clarifyMode = normalizeEnum(app?.ai?.options?.reasoningClarify, ["never", "minimal", "normal"], "minimal");
    const riskyMode = normalizeEnum(app?.ai?.options?.riskyActionsMode, ["confirm", "allow_if_asked", "never"], "confirm");
    const allowQuestions = clarifyMode !== "never" && riskyMode !== "never";
    const selectedRangeInstruction = "If the user asks about selected cells or a highlighted range, call get_selection first and use its result.";
    const attachmentInstruction = "If attached files exist, use file_search first. For exact excerpts, call list_attachments and read_attachment.";
    const runtimeProfileInstruction = buildRuntimeProfileInstructions();
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
    ].join(" ");
  }

  return { agentSystemPrompt };
}
