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

  function estimateExpectedMutationCount(text, hasMutationIntent) {
    if (!hasMutationIntent) return 0;
    const src = String(text || "").toLowerCase();
    let count = 0;

    if (/(созда|create|нов(ую|ая) сборк|new assembly)/i.test(src)) count += 1;
    if (/(добав|insert|append|позиц|материал|автомат)/i.test(src)) count += 1;
    if (/(измени|обнов|поменя|замени|удали|update|set|write|delete|replace|увелич|уменьш)/i.test(src)) count = Math.max(count, 1);

    if (count <= 0) return 1;
    return Math.min(3, count);
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
    const allowQuestions = app?.ai?.options?.allowQuestions !== false;
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
      else if (name === "write_cells") src.applied = Math.max(0, num(src.applied, 0));
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
