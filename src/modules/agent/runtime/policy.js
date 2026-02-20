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

  const TASK_PROFILE_ORDER = ["auto", "fast", "balanced", "bulk", "longrun", "price_search", "proposal", "source_audit", "accurate", "research", "spec_strict", "custom"];
  const NO_REASONING_PROFILE_ORDER = ["quick", "standard", "concise", "detailed", "json", "sources", "cautious", "tool_free", "custom"];
  const NO_REASONING_PROFILE_ALIASES = {
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
  const TASK_PROFILE_PRESETS = {
    fast: {
      serviceTier: "flex",
      reasoningEffort: "low",
      reasoningDepth: "fast",
      reasoningVerify: "off",
      reasoningSummary: "off",
      reasoningClarify: "never",
      toolsMode: "auto",
      brevityMode: "short",
      outputMode: "bullets",
      riskyActionsMode: "allow_if_asked",
      styleMode: "clean",
      citationsMode: "off",
      reasoningMaxTokens: 0,
      compatCache: true,
      promptCacheKeyMode: "off",
      promptCacheKey: "",
      promptCacheRetentionMode: "off",
      promptCacheRetention: "default",
      safetyIdentifierMode: "off",
      safetyIdentifier: "",
      safeTruncationAuto: false,
      backgroundMode: "off",
      backgroundTokenThreshold: 12000,
      compactMode: "off",
      compactThresholdTokens: 90000,
      compactTurnThreshold: 45,
      useConversationState: false,
      structuredSpecOutput: false,
      metadataEnabled: false,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "off",
      lowBandwidthMode: false,
    },
    balanced: {
      serviceTier: "standard",
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
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 12000,
      compactMode: "off",
      compactThresholdTokens: 90000,
      compactTurnThreshold: 45,
      useConversationState: false,
      structuredSpecOutput: false,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "off",
      lowBandwidthMode: false,
    },
    proposal: {
      serviceTier: "standard",
      reasoningEffort: "high",
      reasoningDepth: "deep",
      reasoningVerify: "basic",
      reasoningSummary: "concise",
      reasoningClarify: "minimal",
      toolsMode: "prefer",
      brevityMode: "normal",
      outputMode: "json",
      riskyActionsMode: "confirm",
      styleMode: "clean",
      citationsMode: "on",
      reasoningMaxTokens: 12000,
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 12000,
      compactMode: "auto",
      compactThresholdTokens: 80000,
      compactTurnThreshold: 40,
      useConversationState: true,
      structuredSpecOutput: true,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "auto",
      lowBandwidthMode: false,
    },
    price_search: {
      serviceTier: "flex",
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
      citationsMode: "on",
      reasoningMaxTokens: 18000,
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 7000,
      compactMode: "auto",
      compactThresholdTokens: 70000,
      compactTurnThreshold: 35,
      useConversationState: true,
      structuredSpecOutput: false,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "on",
      lowBandwidthMode: true,
    },
    source_audit: {
      serviceTier: "priority",
      reasoningEffort: "xhigh",
      reasoningDepth: "deep",
      reasoningVerify: "strict",
      reasoningSummary: "concise",
      reasoningClarify: "minimal",
      toolsMode: "prefer",
      brevityMode: "normal",
      outputMode: "bullets",
      riskyActionsMode: "confirm",
      styleMode: "clean",
      citationsMode: "on",
      reasoningMaxTokens: 14000,
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 12000,
      compactMode: "auto",
      compactThresholdTokens: 82000,
      compactTurnThreshold: 40,
      useConversationState: true,
      structuredSpecOutput: false,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "on",
      lowBandwidthMode: false,
    },
    spec_strict: {
      serviceTier: "priority",
      reasoningEffort: "xhigh",
      reasoningDepth: "deep",
      reasoningVerify: "strict",
      reasoningSummary: "detailed",
      reasoningClarify: "minimal",
      toolsMode: "require",
      brevityMode: "detailed",
      outputMode: "json",
      riskyActionsMode: "confirm",
      styleMode: "clean",
      citationsMode: "on",
      reasoningMaxTokens: 24000,
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 12000,
      compactMode: "auto",
      compactThresholdTokens: 70000,
      compactTurnThreshold: 30,
      useConversationState: true,
      structuredSpecOutput: true,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "on",
      lowBandwidthMode: false,
    },
    bulk: {
      serviceTier: "flex",
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
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 9000,
      compactMode: "auto",
      compactThresholdTokens: 85000,
      compactTurnThreshold: 40,
      useConversationState: true,
      structuredSpecOutput: false,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "off",
      lowBandwidthMode: true,
    },
    accurate: {
      serviceTier: "priority",
      reasoningEffort: "xhigh",
      reasoningDepth: "deep",
      reasoningVerify: "strict",
      reasoningSummary: "detailed",
      reasoningClarify: "minimal",
      toolsMode: "prefer",
      brevityMode: "detailed",
      outputMode: "bullets",
      riskyActionsMode: "confirm",
      styleMode: "clean",
      citationsMode: "on",
      reasoningMaxTokens: 20000,
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 14000,
      compactMode: "auto",
      compactThresholdTokens: 80000,
      compactTurnThreshold: 40,
      useConversationState: true,
      structuredSpecOutput: false,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "on",
      lowBandwidthMode: false,
    },
    research: {
      serviceTier: "priority",
      reasoningEffort: "xhigh",
      reasoningDepth: "deep",
      reasoningVerify: "strict",
      reasoningSummary: "detailed",
      reasoningClarify: "minimal",
      toolsMode: "prefer",
      brevityMode: "detailed",
      outputMode: "bullets",
      riskyActionsMode: "confirm",
      styleMode: "clean",
      citationsMode: "on",
      reasoningMaxTokens: 22000,
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "on",
      backgroundTokenThreshold: 22000,
      compactMode: "auto",
      compactThresholdTokens: 78000,
      compactTurnThreshold: 35,
      useConversationState: true,
      structuredSpecOutput: false,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "on",
      lowBandwidthMode: false,
    },
    longrun: {
      serviceTier: "standard",
      reasoningEffort: "medium",
      reasoningDepth: "balanced",
      reasoningVerify: "basic",
      reasoningSummary: "concise",
      reasoningClarify: "never",
      toolsMode: "prefer",
      brevityMode: "normal",
      outputMode: "bullets",
      riskyActionsMode: "allow_if_asked",
      styleMode: "clean",
      citationsMode: "off",
      reasoningMaxTokens: 14000,
      compatCache: true,
      promptCacheKeyMode: "auto",
      promptCacheKey: "",
      promptCacheRetentionMode: "auto",
      promptCacheRetention: "default",
      safetyIdentifierMode: "auto",
      safetyIdentifier: "",
      safeTruncationAuto: true,
      backgroundMode: "auto",
      backgroundTokenThreshold: 10000,
      compactMode: "on",
      compactThresholdTokens: 60000,
      compactTurnThreshold: 20,
      useConversationState: true,
      structuredSpecOutput: false,
      metadataEnabled: true,
      metadataPromptVersionMode: "auto",
      metadataPromptVersion: "v1",
      metadataFrontendBuildMode: "auto",
      metadataFrontendBuild: "",
      includeSourcesMode: "auto",
      lowBandwidthMode: true,
    },
  };

  const NO_REASONING_PROFILE_BASE_PRESET = {
    toolsMode: "auto",
    brevityMode: "normal",
    outputMode: "bullets",
    riskyActionsMode: "allow_if_asked",
    styleMode: "clean",
    citationsMode: "off",
    reasoningMaxTokens: 0,
    compatCache: true,
    promptCacheKeyMode: "auto",
    promptCacheKey: "",
    promptCacheRetentionMode: "auto",
    promptCacheRetention: "default",
    safetyIdentifierMode: "auto",
    safetyIdentifier: "",
    safeTruncationAuto: true,
    backgroundMode: "off",
    backgroundTokenThreshold: 12000,
    compactMode: "off",
    compactThresholdTokens: 90000,
    compactTurnThreshold: 45,
    useConversationState: false,
    structuredSpecOutput: false,
    metadataEnabled: true,
    metadataPromptVersionMode: "auto",
    metadataPromptVersion: "v1",
    metadataFrontendBuildMode: "auto",
    metadataFrontendBuild: "",
    includeSourcesMode: "off",
    lowBandwidthMode: false,
  };

  const NO_REASONING_PROFILE_PRESETS = {
    quick: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
      brevityMode: "short",
      outputMode: "plain",
      promptCacheKeyMode: "off",
      promptCacheRetentionMode: "off",
      safetyIdentifierMode: "off",
      safeTruncationAuto: false,
      metadataEnabled: false,
      lowBandwidthMode: true,
    },
    standard: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
    },
    concise: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
      brevityMode: "short",
      outputMode: "bullets",
      reasoningMaxTokens: 4000,
    },
    detailed: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
      brevityMode: "detailed",
      styleMode: "verbose",
      reasoningMaxTokens: 12000,
      backgroundMode: "auto",
      compactMode: "auto",
      compactThresholdTokens: 70000,
      compactTurnThreshold: 35,
      useConversationState: true,
    },
    json: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
      toolsMode: "prefer",
      outputMode: "json",
      structuredSpecOutput: true,
      reasoningMaxTokens: 8000,
    },
    sources: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
      toolsMode: "require",
      citationsMode: "on",
      includeSourcesMode: "on",
      reasoningMaxTokens: 10000,
    },
    cautious: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
      toolsMode: "prefer",
      riskyActionsMode: "confirm",
      citationsMode: "on",
      includeSourcesMode: "auto",
    },
    tool_free: {
      ...NO_REASONING_PROFILE_BASE_PRESET,
      toolsMode: "none",
      outputMode: "plain",
      citationsMode: "off",
      includeSourcesMode: "off",
      promptCacheKeyMode: "off",
      promptCacheRetentionMode: "off",
      safetyIdentifierMode: "off",
      lowBandwidthMode: true,
    },
  };

  function normalizeTaskProfile(value, fallback = "auto") {
    const raw = String(value || "").trim().toLowerCase();
    if (TASK_PROFILE_ORDER.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return TASK_PROFILE_ORDER.includes(fb) ? fb : "auto";
  }

  function normalizeNoReasoningProfile(value, fallback = "standard") {
    const raw = String(value || "").trim().toLowerCase();
    const mapped = NO_REASONING_PROFILE_ALIASES[raw] || raw;
    if (NO_REASONING_PROFILE_ORDER.includes(mapped)) return mapped;
    const fbRaw = String(fallback || "").trim().toLowerCase();
    const fbMapped = NO_REASONING_PROFILE_ALIASES[fbRaw] || fbRaw;
    return NO_REASONING_PROFILE_ORDER.includes(fbMapped) ? fbMapped : "standard";
  }

  function getTaskProfilePreset(profile) {
    const key = normalizeTaskProfile(profile, "balanced");
    const preset = TASK_PROFILE_PRESETS[key];
    if (!preset) return null;
    const out = { ...preset };
    delete out.serviceTier;
    return out;
  }

  function getNoReasoningProfilePreset(profile) {
    const key = normalizeNoReasoningProfile(profile, "standard");
    const preset = NO_REASONING_PROFILE_PRESETS[key];
    if (!preset) return null;
    return { ...preset };
  }

  function analyzeTaskComplexity(taskTextRaw, options = {}) {
    const text = String(taskTextRaw || "").trim();
    const src = text.toLowerCase();
    const attachmentsCount = Math.max(0, num(options?.attachmentsCount, 0));
    const sentenceCount = (text.match(/[.!?\n]+/g) || []).length;
    const longText = text.length >= 260;
    const numericHints = (src.match(/\b\d{2,4}\b/g) || []).length;

    const simpleDefinitionRe = /^\s*(what is|what's|define|explain|who is|что такое|кто такой|объясни|дай определение)\b/i;
    const sourceScopeRe = /(source code|repository|repo|codebase|module|file|files|project|исходник|репозитор|код|проект|модул|файл)/i;
    const analysisIntentRe = /(code review|static analy|lint|test coverage|refactor|audit|review|debug|root cause|diagnos|investigat|analysis|analy|bug|аудит|ревью|разбор|исслед|проанализ|анализ|причин|почему\s+лома|расслед)/i;
    const deepCueRe = /(deep dive|full audit|end[-\s]?to[-\s]?end|totally|total|fully|unlimited|max(?:imum)?|до конца|тоталь|полност|глубок|максимум|не\s+ограничивай|без\s+огранич)/i;
    const noLimitsCueRe = /(no\s+limit|without\s+limits|as\s+much\s+as\s+needed|unbounded|сколько\s+нужно|без\s+огранич|не\s*хочу[\s\S]{0,24}огранич|ни\s*хочу[\s\S]{0,24}огранич|нихочу[\s\S]{0,24}огранич|нехочу[\s\S]{0,24}огранич)/i;
    const strictAccuracyCueRe = /(exact|strict|100%|zero mistakes|no regression|максимально точно|строго|без ошибок|без регрессий|тотально проверь|проверь всё)/i;
    const researchCueRe = /(research|search|source|citation|cite|web|internet|поиск|источник|ссылк|веб|интернет)/i;
    const longSessionCueRe = /(long running|continuous|many rounds|много шаг|долг\w+\s+диалог|длинн\w+\s+сесси|много\s+раунд)/i;
    const bulkCueRe = /(bulk|batch|import|массов|пакетн|all\s+(items|positions|rows|articles)|все[\s\S]{0,48}(позиц|строк|артикул|элемент))/i;
    const mutationCueRe = /(create|add|update|delete|replace|set|write|change|созда|добав|обнов|измени|удал|замен|заполни|пересчит)/i;
    const multiStepCueRe = /(step|stages|plan|pipeline|workflow|сначала|затем|после|этап|шаг|алгоритм)/i;
    const speedCueRe = /(quick|fast|brief|short|быстр|кратк|коротк)/i;
    const resourceFreedomCueRe = /(не\s+ограничивай|без\s+лимит|без\s+огранич|максимум\s+ресурс|максимально\s+свобод|full\s+resources?|unlimited\s+resources?|as\s+many\s+tool\s+calls\s+as\s+needed|no\s+token\s+limit|no\s+tool\s+limit|без\s+ограничений\s+по\s+(?:ресурс|токен|врем|инструмент|контекст))/i;
    const completionDemandCueRe = /(до\s+конца|полностью|максимум|тотальн|не\s+ограничивай|без\s+огранич|end[-\s]?to[-\s]?end|finish(?:\s+fully)?|complete(?:\s+fully)?|maximum|as\s+much\s+as\s+needed)/i;
    const sourceAuditPairRe = /((source code|repository|repo|codebase|module|file|files|project|исходник|репозитор|код|проект|модул|файл)[\s\S]{0,72}(audit|review|analysis|analy|debug|root cause|diagnos|investigat|аудит|ревью|разбор|исслед|проанализ|анализ|причин|почему\s+лома|расслед))|((audit|review|analysis|analy|debug|root cause|diagnos|investigat|аудит|ревью|разбор|исслед|проанализ|анализ|причин|почему\s+лома|расслед)[\s\S]{0,72}(source code|repository|repo|codebase|module|file|files|project|исходник|репозитор|код|проект|модул|файл))/i;
    const hugeBatchCueRe = /(\b\d{2,4}\b[\s\S]{0,24}(assembl|items|positions|rows|files|modules|сбор|позиц|строк|файл|модул))|(массов|пакетн|bulk|batch)/i;
    const enumItemCount = (text.match(/(?:^|\n)\s*(?:[-*•]|\d+[.)]|[A-Za-zА-Яа-я][.)])\s+/gm) || []).length;

    const simpleDefinition = simpleDefinitionRe.test(src);
    const sourceScope = sourceScopeRe.test(src) || attachmentsCount > 0;
    const analysisIntent = analysisIntentRe.test(src);
    const deepCue = deepCueRe.test(src);
    const resourceFreedomCue = resourceFreedomCueRe.test(src);
    const noLimitsCue = noLimitsCueRe.test(src) || resourceFreedomCue;
    const strictAccuracyCue = strictAccuracyCueRe.test(src);
    const researchCue = researchCueRe.test(src);
    const longSessionCue = longSessionCueRe.test(src);
    const bulkCue = bulkCueRe.test(src);
    const mutationCue = mutationCueRe.test(src);
    const multiStepCue = multiStepCueRe.test(src);
    const speedCue = speedCueRe.test(src);
    const completionDemandCue = completionDemandCueRe.test(src);
    const sourceAuditPairCue = sourceAuditPairRe.test(src);
    const hugeBatchCue = hugeBatchCueRe.test(src);
    const enumeratedListCue = enumItemCount >= 6;

    let score = 0;
    if (sourceScope) score += 4;
    if (analysisIntent) score += 4;
    if (deepCue) score += 4;
    if (noLimitsCue) score += 6;
    if (resourceFreedomCue) score += 3;
    if (strictAccuracyCue) score += 3;
    if (researchCue) score += 2;
    if (longSessionCue) score += 3;
    if (bulkCue) score += 3;
    if (mutationCue) score += 2;
    if (multiStepCue) score += 2;
    if (completionDemandCue) score += 2;
    if (sourceAuditPairCue) score += 3;
    if (hugeBatchCue) score += 3;
    if (enumeratedListCue) score += 2;
    if (attachmentsCount > 0) score += Math.min(4, 1 + Math.floor(Math.log10(attachmentsCount + 1)));
    if (numericHints >= 2) score += Math.min(3, numericHints - 1);
    if (longText) score += 1;
    if (sentenceCount >= 3) score += 1;
    if (simpleDefinition) score -= 3;
    if (simpleDefinition && !sourceScope && !analysisIntent && !deepCue) score -= 2;
    if (speedCue && !analysisIntent && !sourceScope) score -= 1;
    score = Math.max(0, score);

    let severity = "light";
    if (score >= 13) severity = "extreme";
    else if (score >= 9) severity = "heavy";
    else if (score >= 5) severity = "moderate";

    const wantsDeepProfile = noLimitsCue
      || deepCue
      || (sourceScope && analysisIntent)
      || completionDemandCue
      || sourceAuditPairCue
      || resourceFreedomCue
      || strictAccuracyCue
      || severity === "heavy"
      || severity === "extreme";

    const prefersSourceAudit = sourceScope && (analysisIntent || deepCue || noLimitsCue || strictAccuracyCue || sourceAuditPairCue);
    const prefersResearch = researchCue && !mutationCue;
    const prefersLongrun = longSessionCue
      || hugeBatchCue
      || (resourceFreedomCue && (multiStepCue || bulkCue || analysisIntent))
      || (severity === "extreme" && (bulkCue || multiStepCue || enumeratedListCue));
    const canUseFast = severity === "light"
      && !sourceScope
      && !analysisIntent
      && !strictAccuracyCue
      && !deepCue
      && !noLimitsCue;

    return {
      score,
      severity,
      simpleDefinition,
      sourceScope,
      analysisIntent,
      deepCue,
      noLimitsCue,
      strictAccuracyCue,
      researchCue,
      longSessionCue,
      bulkCue,
      mutationCue,
      multiStepCue,
      speedCue,
      completionDemandCue,
      sourceAuditPairCue,
      hugeBatchCue,
      enumeratedListCue,
      resourceFreedomCue,
      wantsDeepProfile,
      prefersSourceAudit,
      prefersResearch,
      prefersLongrun,
      canUseFast,
    };
  }

  function inferAutoTaskProfile(taskTextRaw) {
    const src = String(taskTextRaw || "").toLowerCase();
    if (!src) return { selected: "balanced", reason: "empty_request" };
    const complexity = analyzeTaskComplexity(src);

    if (/(mccb|mcb|rcd|rcbo|contactor|busbar|bom|bill of materials|switchboard|electrical spec|\u0430\u0432\u0442\u043e\u043c\u0430\u0442|\u0443\u0437\u043e|\u0434\u0438\u0444|\u0449\u0438\u0442|\u0441\u043f\u0435\u0446\u0438\u0444)/i.test(src)) {
      return { selected: "spec_strict", reason: "electrical_spec_keywords" };
    }
    if (/(proposal|quotation|offer|\u043a\u043f\b|\u043a\u043e\u043c\u043c\u0435\u0440\u0447)/i.test(src)) {
      return { selected: "proposal", reason: "proposal_keywords" };
    }
    if (/(price search|price lookup|rfq|quote|supplier|\u0446\u0435\u043d\u0430|\u043f\u0440\u0430\u0439\u0441|\u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442|\u043f\u043e\u0441\u0442\u0430\u0432\u0449)/i.test(src)) {
      return { selected: "price_search", reason: "price_search_keywords" };
    }
    if (complexity.noLimitsCue && complexity.sourceScope && complexity.analysisIntent && !complexity.simpleDefinition) {
      return { selected: "source_audit", reason: `source_audit_forced_nolimits_${complexity.severity}` };
    }
    if (complexity.noLimitsCue && !complexity.sourceScope && complexity.analysisIntent && !complexity.mutationCue) {
      return { selected: "research", reason: `research_forced_nolimits_${complexity.severity}` };
    }
    if (complexity.noLimitsCue && complexity.prefersLongrun && complexity.mutationCue) {
      return { selected: "longrun", reason: `longrun_forced_nolimits_${complexity.severity}` };
    }

    if (complexity.prefersSourceAudit && !complexity.simpleDefinition) {
      return { selected: "source_audit", reason: `source_audit_complexity_${complexity.severity}` };
    }
    if (complexity.bulkCue && complexity.prefersLongrun) {
      return { selected: "longrun", reason: "bulk_longrun_complexity" };
    }
    if (complexity.bulkCue) {
      return { selected: "bulk", reason: "bulk_keywords" };
    }
    if (complexity.prefersLongrun) {
      return { selected: "longrun", reason: "long_running_complexity" };
    }

    if (complexity.analysisIntent) {
      if (complexity.sourceScope && !complexity.simpleDefinition) {
        return { selected: "source_audit", reason: `source_scope_analysis_${complexity.severity}` };
      }
      if (complexity.severity === "extreme" || complexity.severity === "heavy") {
        return { selected: "accurate", reason: `analysis_complexity_${complexity.severity}` };
      }
      return { selected: "accurate", reason: "analysis_keywords" };
    }
    if (complexity.prefersResearch) {
      return { selected: "research", reason: `research_complexity_${complexity.severity}` };
    }
    if (complexity.canUseFast && complexity.speedCue) {
      return { selected: "fast", reason: "speed_keywords" };
    }
    if (complexity.severity === "extreme") {
      return { selected: "research", reason: "extreme_complexity_fallback" };
    }
    if (complexity.severity === "heavy") {
      if (complexity.sourceScope || complexity.sourceAuditPairCue) {
        return { selected: "source_audit", reason: "heavy_source_scope_fallback" };
      }
      return { selected: "accurate", reason: "heavy_complexity_fallback" };
    }
    return { selected: "balanced", reason: "default" };
  }

  function shouldAutoEscalateReasoning(taskTextRaw, profileModeRaw = "auto") {
    const escalationModeRaw = String(app?.ai?.options?.autoReasoningEscalationMode || "").trim().toLowerCase();
    const legacyEscalationEnabled = app?.ai?.options?.autoReasoningEscalation !== false;
    const escalationMode = escalationModeRaw === "off" || escalationModeRaw === "auto" || escalationModeRaw === "force"
      ? escalationModeRaw
      : (legacyEscalationEnabled ? "auto" : "off");
    const complexity = analyzeTaskComplexity(taskTextRaw);
    if (escalationMode === "off") return { escalate: false, reason: "auto_escalation_disabled", complexity };

    const mode = normalizeTaskProfile(profileModeRaw, "auto");
    const noReasoningMode = normalizeNoReasoningProfile(app?.ai?.options?.noReasoningProfile, "standard");
    if (noReasoningMode === "custom") {
      return { escalate: false, reason: "manual_no_reasoning_profile_forced", complexity };
    }
    if (mode === "custom") {
      return { escalate: false, reason: "manual_task_profile_forced", complexity };
    }
    const explicitNeed = complexity.noLimitsCue || complexity.deepCue || complexity.prefersSourceAudit;
    const strictNeed = complexity.strictAccuracyCue && (complexity.analysisIntent || complexity.sourceScope);
    const heavyNeed = complexity.severity === "heavy" || complexity.severity === "extreme";
    const moderateNeed = complexity.severity === "moderate" && (complexity.sourceScope || complexity.analysisIntent || complexity.multiStepCue);
    const moderateAuditNeed = moderateNeed && (complexity.prefersSourceAudit || (complexity.sourceScope && complexity.analysisIntent));
    const toolFreeHardBlock = noReasoningMode === "tool_free" && !explicitNeed && complexity.severity !== "extreme";
    if (toolFreeHardBlock) {
      return { escalate: false, reason: "manual_no_reasoning_profile_locked", complexity };
    }
    const escalate = escalationMode === "force"
      ? (explicitNeed || strictNeed || heavyNeed || moderateNeed)
      : (explicitNeed || strictNeed || heavyNeed || moderateAuditNeed);
    return {
      escalate,
      reason: escalate
        ? (escalationMode === "force" ? "forced_complexity_requires_reasoning" : "heavy_complexity_requires_reasoning")
        : "complexity_not_high_enough",
      complexity,
    };
  }

  function resolveTaskProfile(taskTextRaw = "", profileRaw = null) {
    const mode = normalizeTaskProfile(profileRaw ?? app?.ai?.options?.taskProfile, "auto");
    if (app?.ai?.options?.reasoning === false) {
      const escalation = shouldAutoEscalateReasoning(taskTextRaw, mode);
      if (escalation.escalate) {
        const inferred = inferAutoTaskProfile(taskTextRaw);
        const selected = mode !== "auto" && mode !== "custom" ? mode : inferred.selected;
        const baseOverrides = getTaskProfilePreset(selected) || {};
        const overrides = {
          ...baseOverrides,
          reasoning: true,
          executionLimitsMode: "off",
          useConversationState: true,
        };
        if (!overrides.compactMode || overrides.compactMode === "off") overrides.compactMode = "auto";
        const cleanContextHandoffMax = Number(overrides.cleanContextHandoffMax);
        if (!Number.isFinite(cleanContextHandoffMax) || cleanContextHandoffMax < 2) {
          overrides.cleanContextHandoffMax = escalation.complexity.noLimitsCue ? 6 : 3;
        }
        if (escalation.complexity.noLimitsCue || escalation.complexity.severity === "extreme") {
          if (overrides.toolsMode === "auto" || overrides.toolsMode === "prefer") {
            overrides.toolsMode = "require";
          }
          if (overrides.reasoningDepth === "fast") overrides.reasoningDepth = "balanced";
          if (overrides.reasoningVerify === "off") overrides.reasoningVerify = "basic";
          if (overrides.compactMode !== "on") overrides.compactMode = "on";
          if (!Number.isFinite(Number(overrides.compactThresholdTokens)) || Number(overrides.compactThresholdTokens) > 45000) {
            overrides.compactThresholdTokens = 45000;
          }
          if (!Number.isFinite(Number(overrides.compactTurnThreshold)) || Number(overrides.compactTurnThreshold) > 12) {
            overrides.compactTurnThreshold = 12;
          }
          overrides.reasoningMaxTokens = 0;
        }
        return {
          mode: mode === "custom" ? "auto" : (mode === "auto" ? "auto" : mode),
          selected,
          reason: `reasoning_auto_escalated:${inferred.reason}:${escalation.reason}`,
          overrides,
        };
      }

      const noReasoningMode = normalizeNoReasoningProfile(app?.ai?.options?.noReasoningProfile, "standard");
      if (noReasoningMode === "custom") {
        return { mode: "no_reasoning_custom", selected: "custom", reason: "manual_no_reasoning_custom", overrides: null };
      }
      return {
        mode: "no_reasoning",
        selected: noReasoningMode,
        reason: "manual_no_reasoning_profile",
        overrides: getNoReasoningProfilePreset(noReasoningMode),
      };
    }
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

    if (/(create|new assembly|\u0441\u043e\u0437\u0434\u0430|\u043d\u043e\u0432\w+\s+\u0441\u0431\u043e\u0440\u043a)/i.test(src)) count += 1;
    if (/(insert|append|add|position|material|\u0434\u043e\u0431\u0430\u0432|\u043f\u043e\u0437\u0438\u0446|\u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b|\u0430\u0432\u0442\u043e\u043c\u0430\u0442)/i.test(src)) count += 1;
    if (/(update|set|write|delete|replace|change|\u0438\u0437\u043c\u0435\u043d|\u043e\u0431\u043d\u043e\u0432|\u043f\u043e\u043c\u0435\u043d|\u0437\u0430\u043c\u0435\u043d|\u0443\u0434\u0430\u043b|\u0443\u0432\u0435\u043b\u0438\u0447|\u0443\u043c\u0435\u043d\u044c\u0448)/i.test(src)) count = Math.max(count, 1);

    const bulkAllRequested = /(\ball\b|\bevery\b|\beach\b|\u0432\u0441\u0435|\u0432\u0441\u0435\u0445|\u0432\u0441\u044e|\u0432\u0435\u0441\u044c|\u043a\u0430\u0436\u0434)/i.test(src);
    const bulkByArticles = /((all|\u0432\u0441\u0435|\u043a\u0430\u0436\u0434)[^.!?\n]{0,64}(article|sku|item|position|\u0430\u0440\u0442\u0438\u043a\u0443\u043b|\u043f\u043e\u0437\u0438\u0446))/i.test(src);
    if (bulkAllRequested || bulkByArticles) count = Math.max(count, 2);

    const explicitAmountMatch = src.match(/(?:\u0434\u043e|\u043c\u0438\u043d\u0438\u043c\u0443\u043c|\u043d\u0435\s+\u043c\u0435\u043d\u0435\u0435|at\s+least)?\s*(\d{1,4})\s*(?:item|items|sku|article|position|positions|\u043f\u043e\u0437\u0438\u0446|\u0430\u0440\u0442\u0438\u043a\u0443\u043b)/i);
    if (explicitAmountMatch) {
      const explicitAmount = Number.parseInt(explicitAmountMatch[1], 10);
      if (Number.isFinite(explicitAmount)) count = Math.max(count, explicitAmount);
    }

    if (count <= 0) return 1;
    return Math.min(120, Math.max(1, count));
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

  function normalizeToolsMode(value, fallback = "auto") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "none" || raw === "auto" || raw === "prefer" || raw === "require") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "none" || fb === "auto" || fb === "prefer" || fb === "require") return fb;
    return "auto";
  }

  function normalizeExecutionLimitsMode(value, fallback = "off") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "off" || raw === "auto" || raw === "on") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "off" || fb === "auto" || fb === "on") return fb;
    return "off";
  }

  function hasDirectQuestionCue(textRaw) {
    const text = String(textRaw || "").trim();
    if (!text) return false;
    if (/\?\s*$/.test(text) && /(choose|confirm|reply|answer|which|what|could you|would you|need clarification|\u0443\u0442\u043e\u0447\u043d|\u0432\u044b\u0431\u0435\u0440|\u0443\u043a\u0430\u0436|\u043e\u0442\u0432\u0435\u0442|\u043a\u0430\u043a\u043e\u0439\s+\u0432\u0430\u0440\u0438\u0430\u043d\u0442)/i.test(text)) {
      return true;
    }
    return /(\u0443\u0442\u043e\u0447\u043d|\u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435|\u0443\u043a\u0430\u0436\u0438\u0442\u0435|\u043e\u0442\u0432\u0435\u0442\u044c\u0442\u0435|would you like|if you want|need clarification)/i.test(text);
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
    if (!allowQuestions && AI_INCOMPLETE_RESPONSE_RE.test(src)) {
      if (/(questions?\s+(are|is)\s+disabled|\u0432\u043e\u043f\u0440\u043e\u0441\u044b\s+\u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u044b|\u043d\u0435\s+\u043c\u043e\u0433\u0443\s+\u0437\u0430\u0434\u0430\u0432\u0430\u0442\u044c\s+\u0432\u043e\u043f\u0440\u043e\u0441)/i.test(src)) {
        return false;
      }
      return true;
    }
    if (/^(\u0432\u044b\u043f\u043e\u043b\u043d\u044f\u044e|\u043f\u0440\u0438\u0441\u0442\u0443\u043f\u0430\u044e|\u043f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435|\u043d\u0430\u0447\u0438\u043d\u0430\u044e|calling|running|i'?ll run)/i.test(src)) return true;
    return false;
  }

  function shouldForceAgentContinuation(intentToUseTools, intentToMutate, expectedMutations, toolStats, text) {
    if (looksLikePseudoToolText(text)) return true;
    const totalToolCalls = num(toolStats?.totalToolCalls, 0);
    const successfulMutations = num(toolStats?.successfulMutations, 0);
    const toolsMode = normalizeToolsMode(getEffectiveAiOption("toolsMode", "auto"), "auto");
    const toolsRequired = toolsMode === "require";

    const clarifyModeRaw = String(getEffectiveAiOption("reasoningClarify", "never")).trim().toLowerCase();
    const clarifyMode = clarifyModeRaw === "never" || clarifyModeRaw === "minimal" || clarifyModeRaw === "normal"
      ? clarifyModeRaw
      : "never";
    const riskyModeRaw = String(getEffectiveAiOption("riskyActionsMode", "allow_if_asked")).trim().toLowerCase();
    const riskyMode = riskyModeRaw === "confirm" || riskyModeRaw === "allow_if_asked" || riskyModeRaw === "never"
      ? riskyModeRaw
      : "allow_if_asked";
    const allowQuestions = clarifyMode !== "never" && riskyMode !== "never";

    if (totalToolCalls === 0) {
      if (intentToMutate) return true;
      if (toolsRequired && intentToUseTools) return true;
      if (allowQuestions && hasDirectQuestionCue(text) && toolsMode !== "none") return true;
      return false;
    }

    if (isAgentTextIncomplete(text)) return true;

    if (intentToMutate) {
      const expectedRaw = Math.max(0, num(expectedMutations, 0));
      const strictExpected = expectedRaw <= 12
        ? expectedRaw
        : Math.min(12, Math.max(3, Math.round(Math.sqrt(expectedRaw))));
      if (strictExpected > 0 && successfulMutations < strictExpected) return true;
      if (strictExpected <= 0 && successfulMutations === 0) return true;
    }

    return false;
  }

  function buildAgentRetryReason(expectedMutations, toolStats, text) {
    if (isAgentTextIncomplete(text)) return "answer is incomplete";
    if (num(toolStats?.totalToolCalls, 0) === 0) return "model did not call tools";
    if (expectedMutations > 0 && toolStats.mutationCalls === 0) return "model did not call mutation tools";
    if (toolStats.successfulMutations < expectedMutations) {
      const tail = toolStats.failedMutations.slice(-2).join("; ");
      return tail ? `mutations ${toolStats.successfulMutations}/${expectedMutations}; errors: ${tail}` : `mutations ${toolStats.successfulMutations}/${expectedMutations}`;
    }
    return "task is not completed";
  }

  function buildAgentContinuationInstruction(reason, forcedToolFollowup = false) {
    const phase = forcedToolFollowup ? "forced_tool_followup" : "auto_followup";
    return `Phase ${phase}. Retry reason: ${reason}. Continue until the task is fully completed in this same turn. If tools are needed, call them now; if enough data is already available, provide the final completed answer immediately. Do not ask the user to continue, do not postpone work, and do not output tool-call JSON in plain text. Keep assumptions explicit when input data is missing and finish with a concrete result.`;
  }

  function finalOutputCharLimit() {
    const limitsMode = normalizeExecutionLimitsMode(getEffectiveAiOption("executionLimitsMode", "off"), "off");
    if (limitsMode === "off") return Number.MAX_SAFE_INTEGER;
    const brevity = String(getEffectiveAiOption("brevityMode", "normal")).trim().toLowerCase();
    const style = String(getEffectiveAiOption("styleMode", "clean")).trim().toLowerCase();
    const output = String(getEffectiveAiOption("outputMode", "bullets")).trim().toLowerCase();
    let limit = 12000;
    if (brevity === "short") limit = 4000;
    else if (brevity === "detailed") limit = 26000;
    if (style === "verbose") limit += 4000;
    if (output === "json") limit = Math.max(limit, 32000);
    return Math.max(1000, Math.min(64000, limit));
  }

  function sanitizeAgentOutputText(textRaw) {
    const src = String(textRaw || "").trim();
    if (!src) return "Готово.";

    const clarifyModeRaw = String(getEffectiveAiOption("reasoningClarify", "never")).trim().toLowerCase();
    const clarifyMode = clarifyModeRaw === "never" || clarifyModeRaw === "minimal" || clarifyModeRaw === "normal"
      ? clarifyModeRaw
      : "never";
    const riskyModeRaw = String(getEffectiveAiOption("riskyActionsMode", "allow_if_asked")).trim().toLowerCase();
    const riskyMode = riskyModeRaw === "confirm" || riskyModeRaw === "allow_if_asked" || riskyModeRaw === "never"
      ? riskyModeRaw
      : "allow_if_asked";
    const allowQuestions = clarifyMode !== "never" && riskyMode !== "never";

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
      .filter((line) => !/^дальше могу\b/i.test(line))
      .filter((line) => allowQuestions || !hasDirectQuestionCue(line));

    const clean = parts.join(" ").replace(/\s{2,}/g, " ").trim();
    if (!clean) return "Готово.";
    const maxLen = finalOutputCharLimit();
    if (clean.length > maxLen) return `${clean.slice(0, Math.max(0, maxLen - 3))}...`;
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
    analyzeTaskComplexity,
    inferAutoTaskProfile,
    shouldAutoEscalateReasoning,
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

