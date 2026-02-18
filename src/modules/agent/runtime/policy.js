export class AgentRuntimePolicyModule {
  constructor(ctx) {
    Object.assign(this, createAgentRuntimePolicyInternal(ctx));
  }
}

function createAgentRuntimePolicyInternal(ctx) {
  const { app, config, deps } = ctx || {};
  if (!app) throw new Error("AgentRuntimePolicyModule requires app");
  if (!config) throw new Error("AgentRuntimePolicyModule requires config");
  if (!deps) throw new Error("AgentRuntimePolicyModule requires deps");

  const { AI_INCOMPLETE_RESPONSE_RE } = config;
  const { num } = deps;

  if (!(AI_INCOMPLETE_RESPONSE_RE instanceof RegExp)) throw new Error("AgentRuntimePolicyModule requires config.AI_INCOMPLETE_RESPONSE_RE");
  if (typeof num !== "function") throw new Error("AgentRuntimePolicyModule requires deps.num()");

  const TASK_PROFILE_ORDER = ["auto", "balanced", "bulk", "accurate", "research", "fast", "custom"];
  const TASK_PROFILE_PRESETS = {
    fast: {
      reasoningEffort: "low",
      reasoningDepth: "fast",
      reasoningVerify: "basic",
      reasoningSummary: "off",
      reasoningClarify: "never",
      toolsMode: "auto",
      brevityMode: "short",
      outputMode: "bullets",
      riskyActionsMode: "allow_if_asked",
      styleMode: "clean",
      citationsMode: "off",
      reasoningMaxTokens: 0,
    },
    balanced: {
      reasoningEffort: "medium",
      reasoningDepth: "balanced",
      reasoningVerify: "basic",
      reasoningSummary: "auto",
      reasoningClarify: "never",
      toolsMode: "auto",
      brevityMode: "normal",
      outputMode: "bullets",
      riskyActionsMode: "allow_if_asked",
      styleMode: "clean",
      citationsMode: "off",
      reasoningMaxTokens: 0,
    },
    bulk: {
      reasoningEffort: "medium",
      reasoningDepth: "balanced",
      reasoningVerify: "basic",
      reasoningSummary: "concise",
      reasoningClarify: "never",
      toolsMode: "require",
      brevityMode: "short",
      outputMode: "bullets",
      riskyActionsMode: "allow_if_asked",
      styleMode: "clean",
      citationsMode: "off",
      reasoningMaxTokens: 0,
    },
    accurate: {
      reasoningEffort: "high",
      reasoningDepth: "deep",
      reasoningVerify: "strict",
      reasoningSummary: "detailed",
      reasoningClarify: "never",
      toolsMode: "prefer",
      brevityMode: "detailed",
      outputMode: "bullets",
      riskyActionsMode: "confirm",
      styleMode: "clean",
      citationsMode: "on",
      reasoningMaxTokens: 0,
    },
    research: {
      reasoningEffort: "high",
      reasoningDepth: "deep",
      reasoningVerify: "strict",
      reasoningSummary: "concise",
      reasoningClarify: "never",
      toolsMode: "prefer",
      brevityMode: "normal",
      outputMode: "bullets",
      riskyActionsMode: "allow_if_asked",
      styleMode: "clean",
      citationsMode: "on",
      reasoningMaxTokens: 0,
    },
  };

  function normalizeTaskProfile(value, fallback = "auto") {
    const raw = String(value || "").trim().toLowerCase();
    if (TASK_PROFILE_ORDER.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return TASK_PROFILE_ORDER.includes(fb) ? fb : "auto";
  }

  function getTaskProfilePreset(profile) {
    const key = normalizeTaskProfile(profile, "balanced");
    const preset = TASK_PROFILE_PRESETS[key];
    if (!preset) return null;
    return { ...preset };
  }

  function inferAutoTaskProfile(taskTextRaw) {
    const src = String(taskTextRaw || "").toLowerCase();
    if (!src) return { selected: "balanced", reason: "empty_request" };

    const bulkScopeRe = /(\b(all|every|each)\b[\s\S]{0,48}\b(item|items|article|articles|position|positions|row|rows|sku|skus)\b|(\u0432\u0441\u0435|\u043a\u0430\u0436\u0434\w*)[\s\S]{0,48}(\u0430\u0440\u0442\u0438\u043a\u0443\u043b|\u043f\u043e\u0437\u0438\u0446|\u0441\u0442\u0440\u043e\u043a|\u0442\u043e\u0432\u0430\u0440|\u044d\u043b\u0435\u043c\u0435\u043d\u0442|sku))/i;
    if (/(bulk|batch|import|\u0438\u043c\u043f\u043e\u0440\u0442|\u043c\u0430\u0441\u0441\u043e\u0432|\u043f\u0430\u043a\u0435\u0442\u043d)/i.test(src) || bulkScopeRe.test(src)) {
      return { selected: "bulk", reason: "bulk_keywords" };
    }
    if (/(analy|analysis|review|audit|compare|debug|bug|\u0430\u043d\u0430\u043b\u0438\u0437|\u0441\u0440\u0430\u0432\u043d|\u043f\u0440\u043e\u0432\u0435\u0440|\u0430\u0443\u0434\u0438\u0442|\u043e\u0431\u0437\u043e\u0440)/i.test(src)) {
      return { selected: "accurate", reason: "analysis_keywords" };
    }
    if (/(research|search|source|citation|cite|web|internet|\u043f\u043e\u0438\u0441\u043a|\u0438\u0441\u0441\u043b\u0435\u0434|\u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a|\u0441\u0441\u044b\u043b|\u0432\u0435\u0431|\u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442)/i.test(src)) {
      return { selected: "research", reason: "research_keywords" };
    }
    if (/(quick|fast|brief|short|\u0431\u044b\u0441\u0442\u0440|\u043a\u0440\u0430\u0442\u043a|\u043a\u043e\u0440\u043e\u0442\u043a)/i.test(src)) {
      return { selected: "fast", reason: "speed_keywords" };
    }
    return { selected: "balanced", reason: "default" };
  }

  function resolveTaskProfile(taskTextRaw = "", profileRaw = null) {
    const mode = normalizeTaskProfile(profileRaw ?? app?.ai?.options?.taskProfile, "auto");
    if (mode === "custom") {
      return { mode, selected: "custom", reason: "manual_custom", overrides: null };
    }
    if (mode !== "auto") {
      return { mode, selected: mode, reason: "manual_profile", overrides: getTaskProfilePreset(mode) };
    }
    const inferred = inferAutoTaskProfile(taskTextRaw);
    return {
      mode: "auto",
      selected: inferred.selected,
      reason: inferred.reason,
      overrides: getTaskProfilePreset(inferred.selected),
    };
  }

  function getEffectiveAiOption(key, fallback = "") {
    const runtimeOverrides = app?.ai?.runtimeProfile?.overrides;
    if (runtimeOverrides && Object.prototype.hasOwnProperty.call(runtimeOverrides, key)) {
      return runtimeOverrides[key];
    }
    const value = app?.ai?.options?.[key];
    return value === undefined ? fallback : value;
  }

  function estimateExpectedMutationCount(text, hasMutationIntent) {
    if (!hasMutationIntent) return 0;
    const src = String(text || "").toLowerCase();
    let count = 0;

    if (/(созда|create|нов(ую|ая) сборк|new assembly)/i.test(src)) count += 1;
    if (/(добав|insert|append|позиц|материал|автомат)/i.test(src)) count += 1;
    if (/(измени|обнов|поменя|замени|удали|update|set|write|delete|replace|увелич|уменьш)/i.test(src)) count = Math.max(count, 1);

    const bulkAllRequested = /(\ball\b|\bevery\b|\beach\b|все|всех|всю|всей|весь|кажд)/i.test(src);
    const bulkByArticles = /((all|все|кажд)[^.!?\n]{0,64}(article|sku|item|position|артикул|позиц))/i.test(src);
    if (bulkAllRequested) count = Math.max(count, 50);
    if (bulkByArticles) count = Math.max(count, 200);

    const explicitAmountMatch = src.match(/(?:до|минимум|не\s+менее|at\s+least)?\s*(\d{2,4})\s*(?:item|items|sku|article|position|positions|позиц|артикул)/i);
    if (explicitAmountMatch) {
      const explicitAmount = Number.parseInt(explicitAmountMatch[1], 10);
      if (Number.isFinite(explicitAmount)) count = Math.max(count, explicitAmount);
    }

    if (count <= 0) return 1;
    return Math.min(500, Math.max(1, count));
  }

  function looksLikePseudoToolText(text) {
    const src = String(text || "").trim();
    if (!src) return false;
    if (/"to"\s*:\s*"functions\./i.test(src)) return true;
    if (/"recipient_name"\s*:\s*"functions\./i.test(src)) return true;
    if (/"type"\s*:\s*"multi_tool_result"/i.test(src)) return true;
    if (/^###\s*calling\b/i.test(src)) return true;
    return false;
  }

  function isAgentTextIncomplete(text) {
    const src = String(text || "").trim();
    if (!src) return true;
    if (looksLikePseudoToolText(src)) return true;
    const clarifyModeRaw = String(getEffectiveAiOption("reasoningClarify", "never")).trim().toLowerCase();
    const clarifyMode = clarifyModeRaw === "never" || clarifyModeRaw === "minimal" || clarifyModeRaw === "normal"
      ? clarifyModeRaw
      : "never";
    const riskyModeRaw = String(getEffectiveAiOption("riskyActionsMode", "allow_if_asked")).trim().toLowerCase();
    const riskyMode = riskyModeRaw === "confirm" || riskyModeRaw === "allow_if_asked" || riskyModeRaw === "never"
      ? riskyModeRaw
      : "allow_if_asked";
    const allowQuestions = clarifyMode !== "never" && riskyMode !== "never";
    if (!allowQuestions && AI_INCOMPLETE_RESPONSE_RE.test(src)) return true;
    if (/^(выполняю|приступаю|подождите|начинаю|calling|running|i'?ll run)/i.test(src)) return true;
    return false;
  }

  function shouldForceAgentContinuation(intentToUseTools, intentToMutate, expectedMutations, toolStats, text) {
    if (!intentToUseTools && num(toolStats?.totalToolCalls, 0) === 0) return false;
    if (num(toolStats?.totalToolCalls, 0) === 0) return true;
    if (looksLikePseudoToolText(text)) return true;
    if (intentToMutate && toolStats.successfulMutations < expectedMutations) return true;
    if (isAgentTextIncomplete(text)) return true;
    return false;
  }

  function buildAgentRetryReason(expectedMutations, toolStats, text) {
    if (num(toolStats?.totalToolCalls, 0) === 0) return "модель не вызвала инструменты";
    if (expectedMutations > 0 && toolStats.mutationCalls === 0) return "модель не вызвала инструменты изменения";
    if (toolStats.successfulMutations < expectedMutations) {
      const tail = toolStats.failedMutations.slice(-2).join("; ");
      return tail ? `выполнено изменений ${toolStats.successfulMutations}/${expectedMutations}; ошибки: ${tail}` : `выполнено изменений ${toolStats.successfulMutations}/${expectedMutations}`;
    }
    if (isAgentTextIncomplete(text)) return "ответ не завершает задачу";
    return "задача не завершена";
  }

  function buildAgentContinuationInstruction(reason, forcedToolFollowup = false) {
    const phase = forcedToolFollowup ? "forced_tool_followup" : "auto_followup";
    return `Фаза ${phase}. Причина автоповтора: ${reason}. Доведи запрос до конечного результата в этом же ходе через tools. Нельзя задавать вопросы, нельзя просить "продолжай", нельзя откладывать. Если сборка не найдена по assembly_id, используй актуальную выбранную/последнюю сборку или создай новую и продолжи. Для позиций обязателен verification: web_search (query + URL) или attachments. В финальном ответе дай 1-2 коротких предложения без JSON.`;
  }

  function sanitizeAgentOutputText(textRaw) {
    const src = String(textRaw || "").trim();
    if (!src) return "Готово.";

    const parts = src
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^\[(json|tool)/i.test(line))
      .filter((line) => !/^\{[\s\S]*\}$/.test(line))
      .filter((line) => !/^if you want\b/i.test(line))
      .filter((line) => !/^если нужно\b/i.test(line))
      .filter((line) => !/^если хотите\b/i.test(line))
      .filter((line) => !/^дальше могу\b/i.test(line));

    const clean = parts.join(" ").replace(/\s{2,}/g, " ").trim();
    if (!clean) return "Готово.";
    if (clean.length > 900) return `${clean.slice(0, 897)}...`;
    return clean;
  }

  function summarizeToolArgs(args) {
    if (!args || typeof args !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(args)) {
      if (v === undefined) continue;
      if (k === "verification") {
        const sources = Array.isArray(v?.sources) ? v.sources.length : 0;
        const attachments = Array.isArray(v?.attachments) ? v.attachments.length : 0;
        out[k] = { query: String(v?.query || "").slice(0, 180), sources, attachments };
        continue;
      }
      if (Array.isArray(v)) {
        out[k] = `[array:${v.length}]`;
        continue;
      }
      if (v && typeof v === "object") {
        out[k] = `[object:${Object.keys(v).length}]`;
        continue;
      }
      const txt = String(v);
      out[k] = txt.length > 160 ? `${txt.slice(0, 160)}...` : v;
    }
    return out;
  }

  function parseJsonSafe(text, fallback) {
    try {
      return JSON.parse(String(text || ""));
    } catch {
      return fallback;
    }
  }

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

  function isMutationToolName(name) {
    const n = String(name || "").trim();
    return n === "write_cells"
      || n === "write_matrix"
      || n === "copy_range"
      || n === "fill_range"
      || n === "replace_in_range"
      || n === "set_state_value"
      || n === "update_settings"
      || n === "create_assembly"
      || n === "update_assembly"
      || n === "duplicate_assembly"
      || n === "delete_assembly"
      || n === "bulk_delete_assemblies"
      || n === "add_position"
      || n === "update_position"
      || n === "delete_position"
      || n === "duplicate_position"
      || n === "move_position"
      || n === "add_project_position"
      || n === "update_project_position"
      || n === "delete_project_position"
      || n === "toggle_project_consumables"
      || n === "clear_range"
      || n === "clear_sheet_overrides";
  }

  function normalizeToolResult(name, raw) {
    const src = raw && typeof raw === "object" ? { ...raw } : { ok: false, error: "invalid tool result" };
    if (src.ok === undefined) src.ok = !src.error;
    if (!Array.isArray(src.warnings)) src.warnings = [];
    if (src.applied === undefined) {
      if (!isMutationToolName(name)) src.applied = 0;
      else if (
        name === "write_cells"
        || name === "write_matrix"
        || name === "copy_range"
        || name === "fill_range"
        || name === "replace_in_range"
      ) {
        src.applied = Math.max(0, num(src.applied, 0));
      }
      else src.applied = src.ok ? 1 : 0;
    }
    if (!src.entity) {
      if (src.assembly) src.entity = { type: "assembly", id: src.assembly.id || "" };
      else if (src.position) src.entity = { type: "position", id: src.position.id || "" };
      else if (src.sheet) src.entity = { type: "sheet", id: src.sheet.id || "" };
    }
    return src;
  }

  return {
    estimateExpectedMutationCount,
    normalizeTaskProfile,
    getTaskProfilePreset,
    inferAutoTaskProfile,
    resolveTaskProfile,
    looksLikePseudoToolText,
    isAgentTextIncomplete,
    shouldForceAgentContinuation,
    buildAgentRetryReason,
    buildAgentContinuationInstruction,
    sanitizeAgentOutputText,
    summarizeToolArgs,
    normalizeToolResult,
    parseJsonSafe,
    parseJsonValue,
    isMutationToolName,
  };
}
