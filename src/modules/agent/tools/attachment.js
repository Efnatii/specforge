const TEXT_ATTACHMENT_EXT_RE = /\.(txt|md|csv|json|xml|yml|yaml|js|ts|html|css|ini|log|sql)$/i;
const EXCEL_ATTACHMENT_EXT_RE = /\.(xlsx|xlsm)$/i;
const EXCEL_ATTACHMENT_TYPE_RE = /(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel\.sheet\.macroenabled\.12)/i;
const TEXT_ATTACHMENT_MAX_CHARS = 120000;
const EXCEL_ATTACHMENT_MAX_CHARS = 120000;
const EXCEL_ATTACHMENT_MAX_SHEETS = 6;
const EXCEL_ATTACHMENT_MAX_ROWS = 120;
const EXCEL_ATTACHMENT_MAX_COLS = 20;
const ATTACHMENT_CELL_MAX_CHARS = 240;
const REASONING_EFFORT_ORDER = ["low", "medium", "high", "xhigh"];
const WEB_SEARCH_CONTEXT_SIZE_ORDER = ["low", "medium", "high"];
const REASONING_DEPTH_ORDER = ["fast", "balanced", "deep"];
const REASONING_VERIFY_ORDER = ["off", "basic", "strict"];
const REASONING_SUMMARY_ORDER = ["auto", "concise", "detailed", "off"];
const REASONING_CLARIFY_ORDER = ["never", "minimal", "normal"];
const TOOLS_MODE_ORDER = ["auto", "prefer", "require", "none"];
const BREVITY_MODE_ORDER = ["short", "normal", "detailed"];
const OUTPUT_MODE_ORDER = ["plain", "bullets", "json"];
const RISKY_ACTIONS_MODE_ORDER = ["allow_if_asked", "confirm", "never"];
const STYLE_MODE_ORDER = ["clean", "verbose"];
const CITATIONS_MODE_ORDER = ["off", "on"];
const TASK_PROFILE_ORDER = ["auto", "fast", "balanced", "bulk", "longrun", "price_search", "proposal", "source_audit", "accurate", "research", "spec_strict", "custom"];
const OPTIONAL_TEXT_MODE_ORDER = ["auto", "off", "custom"];
const BACKGROUND_MODE_ORDER = ["off", "auto", "on"];
const COMPACT_MODE_ORDER = ["off", "auto", "on"];
const INCLUDE_SOURCES_MODE_ORDER = ["off", "auto", "on"];
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

export class AgentAttachmentModule {
  constructor({
    app,
    dom,
    addChangesJournal,
    saveAiOptions,
    renderAiUi,
    toast,
    createId,
    num,
  }) {
    if (!app) throw new Error("AgentAttachmentModule requires app");
    if (!dom) throw new Error("AgentAttachmentModule requires dom");
    if (typeof addChangesJournal !== "function") throw new Error("AgentAttachmentModule requires addChangesJournal()");
    if (typeof saveAiOptions !== "function") throw new Error("AgentAttachmentModule requires saveAiOptions()");
    if (typeof renderAiUi !== "function") throw new Error("AgentAttachmentModule requires renderAiUi()");
    if (typeof toast !== "function") throw new Error("AgentAttachmentModule requires toast()");
    if (typeof createId !== "function") throw new Error("AgentAttachmentModule requires createId()");
    if (typeof num !== "function") throw new Error("AgentAttachmentModule requires num()");

    this._app = app;
    this._dom = dom;
    this._addChangesJournal = addChangesJournal;
    this._saveAiOptions = saveAiOptions;
    this._renderAiUi = renderAiUi;
    this._toast = toast;
    this._createId = createId;
    this._num = num;
  }

  onAgentChipClick(e) {
    const webActionBtn = e.target.closest("[data-web-search-action]");
    if (webActionBtn) {
      const action = String(webActionBtn.dataset.webSearchAction || "");
      if (action === "close") {
        this._app.ai.webSearchPopoverOpen = false;
        this._renderAiUi();
      }
      return;
    }

    const reasoningActionBtn = e.target.closest("[data-reasoning-action]");
    if (reasoningActionBtn) {
      const action = String(reasoningActionBtn.dataset.reasoningAction || "");
      if (action === "close") {
        this._app.ai.reasoningPopoverOpen = false;
        this._renderAiUi();
      }
      return;
    }

    const settingsBtn = e.target.closest("[data-ai-chip-option]");
    if (settingsBtn) {
      const option = String(settingsBtn.dataset.aiChipOption || "");
      if (option === "webSearchSettings") {
        this._app.ai.reasoningPopoverOpen = false;
        this._app.ai.webSearchPopoverOpen = !this._app.ai.webSearchPopoverOpen;
        this._renderAiUi();
        return;
      }
      if (option === "reasoningSettings") {
        this._app.ai.webSearchPopoverOpen = false;
        this._app.ai.reasoningPopoverOpen = !this._app.ai.reasoningPopoverOpen;
        this._renderAiUi();
        return;
      }
    }

    const remove = e.target.closest("button.remove");
    if (!remove) return;
    const chip = e.target.closest(".agent-chip");
    if (!chip) return;
    const type = chip.dataset.chipType;
    if (type !== "file") return;

    const id = chip.dataset.chipId;
    const removed = this._app.ai.attachments.find((f) => f.id === id);
    this._app.ai.attachments = this._app.ai.attachments.filter((f) => f.id !== id);
    if (removed) {
      this._addChangesJournal("ai.file.detach", removed.name);
      this._invalidateFileSearchSync();
    }
    this._renderAiUi();
  }

  onDocumentClick(e) {
    if (!this._app.ai.webSearchPopoverOpen && !this._app.ai.reasoningPopoverOpen) return;
    const target = e?.target || null;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("[data-web-search-wrap]")) return;
    if (target.closest("[data-reasoning-wrap]")) return;
    this._app.ai.webSearchPopoverOpen = false;
    this._app.ai.reasoningPopoverOpen = false;
    this._renderAiUi();
  }

  onAgentContextIconsClick(e) {
    const btn = e.target.closest("[data-ai-option]");
    if (!btn) return;
    const option = String(btn.dataset.aiOption || "");

    if (option === "files") {
      this._dom.agentAttachmentInput.click();
      return;
    }

    if (option === "webSearch") {
      const next = !Boolean(this._app.ai.options.webSearch);
      this._app.ai.options.webSearch = next;
      if (!next) this._app.ai.webSearchPopoverOpen = false;
      this._saveAiOptions();
      this._addChangesJournal("ai.option", `webSearch=${next ? "on" : "off"}`);
      this._renderAiUi();
      return;
    }

    if (option === "reasoning") {
      const current = this._app.ai.options.reasoning !== false;
      const next = !current;
      this._app.ai.options.reasoning = next;
      if (!next) this._app.ai.reasoningPopoverOpen = false;
      this._saveAiOptions();
      this._addChangesJournal("ai.option", `reasoning=${next ? "on" : "off"}`);
      this._renderAiUi();
      return;
    }

    this._app.ai.webSearchPopoverOpen = false;
    this._app.ai.reasoningPopoverOpen = false;
    if (!(option in this._app.ai.options)) return;
    this._app.ai.options[option] = !this._app.ai.options[option];
    this._saveAiOptions();
    this._addChangesJournal("ai.option", `${option}=${this._app.ai.options[option] ? "on" : "off"}`);
    this._renderAiUi();
  }

  onAgentContextIconsChange(e) {
    const target = e?.target || null;
    const webField = String(target?.dataset?.webSearchConfig || "");
    const reasoningField = String(target?.dataset?.reasoningConfig || "");
    const reasoningEffortRank = (value) => {
      const normalized = this._normalizeReasoningEffort(value, "medium");
      const idx = REASONING_EFFORT_ORDER.indexOf(normalized);
      return idx >= 0 ? idx : 0;
    };
    const requiredEffortByDepthVerify = (depthRaw, verifyRaw) => {
      const depth = this._normalizeReasoningDepth(depthRaw, "balanced");
      const verify = this._normalizeReasoningVerify(verifyRaw, "basic");
      if (depth === "deep" && verify === "strict") return "xhigh";
      if (depth === "deep") return "high";
      if (verify === "strict") return "high";
      if (depth === "fast" && verify === "off") return "low";
      return "medium";
    };
    const requiredDepthVerifyByEffort = (effortRaw) => {
      const effort = this._normalizeReasoningEffort(effortRaw, "medium");
      if (effort === "xhigh") return { depth: "deep", verify: "strict" };
      if (effort === "high") return { depth: "deep", verify: "basic" };
      if (effort === "low") return { depth: "fast", verify: "off" };
      return { depth: "balanced", verify: "basic" };
    };
    const applyReasoningDependencies = (trigger = "") => {
      let changed = false;
      const setOption = (key, value, reason = "") => {
        if (this._app.ai.options[key] === value) return;
        this._app.ai.options[key] = value;
        const note = reason ? ` (${reason})` : "";
        this._addChangesJournal("ai.option", `${key}=${value}${note}`);
        changed = true;
      };

      const triggerKey = String(trigger || "").trim();
      const shouldSyncReasoningCore = triggerKey === "effort" || triggerKey === "depth" || triggerKey === "verify" || triggerKey === "profile";
      if (shouldSyncReasoningCore) {
        if (triggerKey === "effort") {
          const currentEffort = this._normalizeReasoningEffort(this._app.ai.options.reasoningEffort || "medium", "medium");
          const pair = requiredDepthVerifyByEffort(currentEffort);
          setOption("reasoningDepth", pair.depth, "авто: зависит от effort");
          setOption("reasoningVerify", pair.verify, "авто: зависит от effort");
        } else {
          const depth = this._normalizeReasoningDepth(this._app.ai.options.reasoningDepth || "balanced", "balanced");
          const verify = this._normalizeReasoningVerify(this._app.ai.options.reasoningVerify || "basic", "basic");
          const expectedEffort = requiredEffortByDepthVerify(depth, verify);
          const currentEffort = this._normalizeReasoningEffort(this._app.ai.options.reasoningEffort || "medium", "medium");
          if (expectedEffort && currentEffort !== expectedEffort) {
            this._app.ai.options.reasoningEffort = expectedEffort;
            this._addChangesJournal("ai.option", `reasoningEffort=${expectedEffort} (авто: зависит от depth/verify)`);
            changed = true;
          }
        }
      }

      const risky = this._normalizeRiskyActionsMode(this._app.ai.options.riskyActionsMode || "allow_if_asked", "allow_if_asked");
      const clarify = this._normalizeReasoningClarify(this._app.ai.options.reasoningClarify || "never", "never");
      if (triggerKey === "clarify" && clarify !== "never" && risky === "never") {
        setOption("riskyActionsMode", "confirm", "авто: чтобы разрешить уточнения");
      } else if (risky === "never") {
        if (clarify !== "never") {
          setOption("reasoningClarify", "never", "авто: riskyActionsMode=never");
        }
        this._app.ai.pendingQuestion = null;
      }

      const structured = this._normalizeBooleanSelect(this._app.ai.options.structuredSpecOutput, false);
      const output = this._normalizeOutputMode(this._app.ai.options.outputMode || "bullets", "bullets");
      if (triggerKey === "outputMode") {
        if (output === "json" && !structured) setOption("structuredSpecOutput", true, "авто: outputMode=json");
        if (output !== "json" && structured) setOption("structuredSpecOutput", false, "авто: outputMode!=json");
      } else if (triggerKey === "structuredSpecOutput") {
        if (structured && output !== "json") setOption("outputMode", "json", "авто: structuredSpecOutput=on");
        if (!structured && output === "json") setOption("outputMode", "bullets", "авто: structuredSpecOutput=off");
      }

      const includeSourcesMode = this._normalizeIncludeSourcesMode(this._app.ai.options.includeSourcesMode || "off", "off");
      const citationsMode = this._normalizeCitationsMode(this._app.ai.options.citationsMode || "off", "off");
      if (triggerKey === "includeSourcesMode" && includeSourcesMode === "on" && citationsMode !== "on") {
        setOption("citationsMode", "on", "авто: includeSourcesMode=on");
      } else if (triggerKey === "citationsMode" && citationsMode === "on" && includeSourcesMode === "off") {
        setOption("includeSourcesMode", "auto", "авто: citationsMode=on");
      }

      const compactMode = this._normalizeCompactMode(this._app.ai.options.compactMode || "off", "off");
      const useConversationState = this._normalizeBooleanSelect(this._app.ai.options.useConversationState, false);
      if (triggerKey === "useConversationState" && !useConversationState && compactMode === "on") {
        setOption("compactMode", "auto", "авто: useConversationState=off");
      } else if (compactMode === "on" && !useConversationState) {
        setOption("useConversationState", true, "авто: compactMode=on");
      }

      if (shouldSyncReasoningCore) {
        const effort = this._normalizeReasoningEffort(this._app.ai.options.reasoningEffort || "medium", "medium");
        const depth = this._normalizeReasoningDepth(this._app.ai.options.reasoningDepth || "balanced", "balanced");
        const verify = this._normalizeReasoningVerify(this._app.ai.options.reasoningVerify || "basic", "basic");
        const minEffort = requiredEffortByDepthVerify(depth, verify);
        if (reasoningEffortRank(effort) < reasoningEffortRank(minEffort)) {
          setOption("reasoningEffort", minEffort, "авто: минимальный уровень для depth/verify");
        }
      }

      return changed;
    };
    const markTaskProfileCustom = () => {
      const currentProfile = this._normalizeTaskProfile(this._app.ai.options.taskProfile || "auto", "auto");
      if (currentProfile === "custom") return false;
      this._app.ai.options.taskProfile = "custom";
      this._addChangesJournal("ai.option", "taskProfile=custom");
      return true;
    };
    const promptForCustomValue = (title, currentValue = "", hint = "") => {
      const promptFn = globalThis?.window?.prompt || globalThis?.prompt;
      if (typeof promptFn !== "function") return { canceled: true, value: String(currentValue || "") };
      const message = hint ? `${title}\n${hint}` : title;
      const entered = promptFn(message, String(currentValue || ""));
      if (entered === null) return { canceled: true, value: String(currentValue || "") };
      return { canceled: false, value: String(entered || "") };
    };
    const updateReasoningOption = (key, value, journalKey = key, dependencyTrigger = key) => {
      if (this._app.ai.options[key] === value) return false;
      const triggerAliases = {
        reasoningEffort: "effort",
        reasoningDepth: "depth",
        reasoningVerify: "verify",
        reasoningClarify: "clarify",
      };
      const dependencyKey = triggerAliases[String(dependencyTrigger || key)] || dependencyTrigger || key;
      this._app.ai.options[key] = value;
      if (key !== "taskProfile") markTaskProfileCustom();
      this._addChangesJournal("ai.option", `${journalKey}=${value}`);
      applyReasoningDependencies(dependencyKey);
      this._app.ai.runtimeProfile = null;
      this._saveAiOptions();
      return true;
    };

    if (webField === "country") {
      const next = this._normalizeWebSearchCountry(target.value, this._app.ai.options.webSearchCountry || "RU");
      if (this._app.ai.options.webSearchCountry !== next) {
        this._app.ai.options.webSearchCountry = next;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `webSearchCountry=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (webField === "contextSize") {
      const next = this._normalizeWebSearchContextSize(target.value, this._app.ai.options.webSearchContextSize || "high");
      if (this._app.ai.options.webSearchContextSize !== next) {
        this._app.ai.options.webSearchContextSize = next;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `webSearchContextSize=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "effort") {
      const next = this._normalizeReasoningEffort(target.value, this._app.ai.options.reasoningEffort || "medium");
      updateReasoningOption("reasoningEffort", next, "reasoningEffort");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "taskProfile") {
      const next = this._normalizeTaskProfile(target.value, this._app.ai.options.taskProfile || "auto");
      const changed = this._app.ai.options.taskProfile !== next;
      this._app.ai.options.taskProfile = next;
      if (next !== "auto" && next !== "custom") {
        const preset = this._taskProfilePreset(next);
        if (preset) {
          for (const [key, value] of Object.entries(preset)) {
            this._app.ai.options[key] = value;
          }
        }
      }
      applyReasoningDependencies("profile");
      this._app.ai.runtimeProfile = null;
      this._saveAiOptions();
      if (changed) this._addChangesJournal("ai.option", `taskProfile=${next}`);
      this._renderAiUi();
      return;
    }
    if (reasoningField === "depth") {
      const next = this._normalizeReasoningDepth(target.value, this._app.ai.options.reasoningDepth || "balanced");
      updateReasoningOption("reasoningDepth", next, "reasoningDepth");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "verify") {
      const next = this._normalizeReasoningVerify(target.value, this._app.ai.options.reasoningVerify || "basic");
      updateReasoningOption("reasoningVerify", next, "reasoningVerify");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "summaryMode") {
      const next = this._normalizeReasoningSummary(target.value, this._app.ai.options.reasoningSummary || "auto");
      updateReasoningOption("reasoningSummary", next, "reasoningSummary");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "clarify") {
      const next = this._normalizeReasoningClarify(target.value, this._app.ai.options.reasoningClarify || "never");
      updateReasoningOption("reasoningClarify", next, "reasoningClarify");
      if (next === "never") this._app.ai.pendingQuestion = null;
      this._renderAiUi();
      return;
    }
    if (reasoningField === "toolsMode") {
      const next = this._normalizeToolsMode(target.value, this._app.ai.options.toolsMode || "auto");
      updateReasoningOption("toolsMode", next, "toolsMode");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "brevityMode") {
      const next = this._normalizeBrevityMode(target.value, this._app.ai.options.brevityMode || "normal");
      updateReasoningOption("brevityMode", next, "brevityMode");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "outputMode") {
      const next = this._normalizeOutputMode(target.value, this._app.ai.options.outputMode || "bullets");
      updateReasoningOption("outputMode", next, "outputMode");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "riskyActionsMode") {
      const next = this._normalizeRiskyActionsMode(target.value, this._app.ai.options.riskyActionsMode || "allow_if_asked");
      updateReasoningOption("riskyActionsMode", next, "riskyActionsMode");
      if (next === "never") this._app.ai.pendingQuestion = null;
      this._renderAiUi();
      return;
    }
    if (reasoningField === "styleMode") {
      const next = this._normalizeStyleMode(target.value, this._app.ai.options.styleMode || "clean");
      updateReasoningOption("styleMode", next, "styleMode");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "citationsMode") {
      const next = this._normalizeCitationsMode(target.value, this._app.ai.options.citationsMode || "off");
      updateReasoningOption("citationsMode", next, "citationsMode");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "maxTokens") {
      const next = this._normalizeReasoningMaxTokens(target.value, this._app.ai.options.reasoningMaxTokens || 0);
      updateReasoningOption("reasoningMaxTokens", next, "reasoningMaxTokens");
      this._renderAiUi();
      return;
    }
    if (reasoningField === "compatCache") {
      const raw = String(target.value || "").trim().toLowerCase();
      const next = raw !== "off";
      if (this._app.ai.options.compatCache !== next) {
        this._app.ai.options.compatCache = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `compatCache=${next ? "on" : "off"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "promptCacheKeyMode") {
      const prevMode = this._normalizeOptionalTextMode(this._app.ai.options.promptCacheKeyMode || "auto", "auto");
      const next = this._normalizeOptionalTextMode(target.value, this._app.ai.options.promptCacheKeyMode || "auto");
      let changed = false;
      if (next === "custom") {
        const current = this._normalizePromptCacheKey(this._app.ai.options.promptCacheKey || "", "");
        const asked = promptForCustomValue(
          "Ключ кэша промпта",
          current,
          "Введите ключ prompt_cache_key (пример: specforge_v2_batch_prices).",
        );
        if (asked.canceled) {
          this._renderAiUi();
          return;
        }
        const custom = this._normalizePromptCacheKey(asked.value, "");
        if (!custom) {
          this._toast("Ключ кэша не задан");
          this._renderAiUi();
          return;
        }
        if (this._app.ai.options.promptCacheKey !== custom) {
          this._app.ai.options.promptCacheKey = custom;
          this._addChangesJournal("ai.option", "promptCacheKey=set");
          changed = true;
        }
      }
      if (this._app.ai.options.promptCacheKeyMode !== next) {
        this._app.ai.options.promptCacheKeyMode = next;
        changed = true;
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        if (prevMode !== next) this._addChangesJournal("ai.option", `promptCacheKeyMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "promptCacheKey") {
      const next = this._normalizePromptCacheKey(target.value, "");
      let changed = false;
      if (this._app.ai.options.promptCacheKey !== next) {
        this._app.ai.options.promptCacheKey = next;
        changed = true;
      }
      if (next && this._normalizeOptionalTextMode(this._app.ai.options.promptCacheKeyMode, "auto") !== "custom") {
        this._app.ai.options.promptCacheKeyMode = "custom";
        changed = true;
        this._addChangesJournal("ai.option", "promptCacheKeyMode=custom (авто: введено значение)");
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `promptCacheKey=${next ? "set" : "empty"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "promptCacheRetentionMode") {
      const prevMode = this._normalizeOptionalTextMode(this._app.ai.options.promptCacheRetentionMode || "auto", "auto");
      const next = this._normalizeOptionalTextMode(target.value, this._app.ai.options.promptCacheRetentionMode || "auto");
      let changed = false;
      if (next === "custom") {
        const current = this._normalizePromptCacheRetention(this._app.ai.options.promptCacheRetention || "", "24h");
        const asked = promptForCustomValue(
          "Удержание кэша промпта",
          current,
          "Введите prompt_cache_retention: 24h или in-memory.",
        );
        if (asked.canceled) {
          this._renderAiUi();
          return;
        }
        const custom = this._normalizePromptCacheRetention(asked.value, "default");
        if (custom !== "24h" && custom !== "in-memory" && custom !== "default") {
          this._toast("Допустимо: 24h, in-memory или default");
          this._renderAiUi();
          return;
        }
        if (this._app.ai.options.promptCacheRetention !== custom) {
          this._app.ai.options.promptCacheRetention = custom;
          changed = true;
          this._addChangesJournal("ai.option", `promptCacheRetention=${custom}`);
        }
      }
      if (this._app.ai.options.promptCacheRetentionMode !== next) {
        this._app.ai.options.promptCacheRetentionMode = next;
        changed = true;
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        if (prevMode !== next) this._addChangesJournal("ai.option", `promptCacheRetentionMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "promptCacheRetention") {
      const next = this._normalizePromptCacheRetention(target.value, this._app.ai.options.promptCacheRetention || "default");
      let changed = false;
      if (this._app.ai.options.promptCacheRetention !== next) {
        this._app.ai.options.promptCacheRetention = next;
        changed = true;
      }
      if (next !== "default" && this._normalizeOptionalTextMode(this._app.ai.options.promptCacheRetentionMode, "auto") !== "custom") {
        this._app.ai.options.promptCacheRetentionMode = "custom";
        changed = true;
        this._addChangesJournal("ai.option", "promptCacheRetentionMode=custom (авто: введено значение)");
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `promptCacheRetention=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "safetyIdentifierMode") {
      const prevMode = this._normalizeOptionalTextMode(this._app.ai.options.safetyIdentifierMode || "auto", "auto");
      const next = this._normalizeOptionalTextMode(target.value, this._app.ai.options.safetyIdentifierMode || "auto");
      let changed = false;
      if (next === "custom") {
        const current = this._normalizeSafetyIdentifier(this._app.ai.options.safetyIdentifier || "", "");
        const asked = promptForCustomValue(
          "Идентификатор безопасности",
          current,
          "Введите safety_identifier (пример: user_42_task_15).",
        );
        if (asked.canceled) {
          this._renderAiUi();
          return;
        }
        const custom = this._normalizeSafetyIdentifier(asked.value, "");
        if (!custom) {
          this._toast("Идентификатор безопасности не задан");
          this._renderAiUi();
          return;
        }
        if (this._app.ai.options.safetyIdentifier !== custom) {
          this._app.ai.options.safetyIdentifier = custom;
          this._addChangesJournal("ai.option", "safetyIdentifier=set");
          changed = true;
        }
      }
      if (this._app.ai.options.safetyIdentifierMode !== next) {
        this._app.ai.options.safetyIdentifierMode = next;
        changed = true;
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        if (prevMode !== next) this._addChangesJournal("ai.option", `safetyIdentifierMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "safetyIdentifier") {
      const next = this._normalizeSafetyIdentifier(target.value, "");
      let changed = false;
      if (this._app.ai.options.safetyIdentifier !== next) {
        this._app.ai.options.safetyIdentifier = next;
        changed = true;
      }
      if (next && this._normalizeOptionalTextMode(this._app.ai.options.safetyIdentifierMode, "auto") !== "custom") {
        this._app.ai.options.safetyIdentifierMode = "custom";
        changed = true;
        this._addChangesJournal("ai.option", "safetyIdentifierMode=custom (авто: введено значение)");
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `safetyIdentifier=${next ? "set" : "empty"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "safeTruncationAuto") {
      const next = this._normalizeBooleanSelect(target.value, this._app.ai.options.safeTruncationAuto === true);
      if (this._app.ai.options.safeTruncationAuto !== next) {
        this._app.ai.options.safeTruncationAuto = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `safeTruncationAuto=${next ? "on" : "off"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "backgroundMode") {
      const next = this._normalizeBackgroundMode(target.value, this._app.ai.options.backgroundMode || "auto");
      if (this._app.ai.options.backgroundMode !== next) {
        this._app.ai.options.backgroundMode = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `backgroundMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "backgroundTokenThreshold") {
      const next = this._normalizeTokenThreshold(target.value, this._app.ai.options.backgroundTokenThreshold || 12000, 2000, 2000000);
      if (this._app.ai.options.backgroundTokenThreshold !== next) {
        this._app.ai.options.backgroundTokenThreshold = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `backgroundTokenThreshold=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "compactMode") {
      const next = this._normalizeCompactMode(target.value, this._app.ai.options.compactMode || "off");
      if (this._app.ai.options.compactMode !== next) {
        this._app.ai.options.compactMode = next;
        markTaskProfileCustom();
        applyReasoningDependencies("compactMode");
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `compactMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "compactThresholdTokens") {
      const next = this._normalizeTokenThreshold(target.value, this._app.ai.options.compactThresholdTokens || 90000, 1000, 4000000);
      if (this._app.ai.options.compactThresholdTokens !== next) {
        this._app.ai.options.compactThresholdTokens = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `compactThresholdTokens=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "compactTurnThreshold") {
      const next = this._normalizeTurnThreshold(target.value, this._app.ai.options.compactTurnThreshold || 45, 1, 10000);
      if (this._app.ai.options.compactTurnThreshold !== next) {
        this._app.ai.options.compactTurnThreshold = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `compactTurnThreshold=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "useConversationState") {
      const next = this._normalizeBooleanSelect(target.value, this._app.ai.options.useConversationState === true);
      if (this._app.ai.options.useConversationState !== next) {
        this._app.ai.options.useConversationState = next;
        markTaskProfileCustom();
        applyReasoningDependencies("useConversationState");
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `useConversationState=${next ? "on" : "off"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "structuredSpecOutput") {
      const next = this._normalizeBooleanSelect(target.value, this._app.ai.options.structuredSpecOutput === true);
      if (this._app.ai.options.structuredSpecOutput !== next) {
        this._app.ai.options.structuredSpecOutput = next;
        markTaskProfileCustom();
        applyReasoningDependencies("structuredSpecOutput");
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `structuredSpecOutput=${next ? "on" : "off"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "metadataEnabled") {
      const next = this._normalizeBooleanSelect(target.value, this._app.ai.options.metadataEnabled !== false);
      if (this._app.ai.options.metadataEnabled !== next) {
        this._app.ai.options.metadataEnabled = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `metadataEnabled=${next ? "on" : "off"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "metadataPromptVersionMode") {
      const prevMode = this._normalizeOptionalTextMode(this._app.ai.options.metadataPromptVersionMode || "auto", "auto");
      const next = this._normalizeOptionalTextMode(target.value, this._app.ai.options.metadataPromptVersionMode || "auto");
      let changed = false;
      if (next === "custom") {
        const current = this._normalizeMetadataTag(this._app.ai.options.metadataPromptVersion || "", "v1");
        const asked = promptForCustomValue(
          "Версия промпта (metadata.prompt_version)",
          current,
          "Введите тег версии (пример: spec-2026-02).",
        );
        if (asked.canceled) {
          this._renderAiUi();
          return;
        }
        const custom = this._normalizeMetadataTag(asked.value, "");
        if (!custom) {
          this._toast("Версия промпта не задана");
          this._renderAiUi();
          return;
        }
        if (this._app.ai.options.metadataPromptVersion !== custom) {
          this._app.ai.options.metadataPromptVersion = custom;
          changed = true;
          this._addChangesJournal("ai.option", `metadataPromptVersion=${custom}`);
        }
      }
      if (this._app.ai.options.metadataPromptVersionMode !== next) {
        this._app.ai.options.metadataPromptVersionMode = next;
        changed = true;
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        if (prevMode !== next) this._addChangesJournal("ai.option", `metadataPromptVersionMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "metadataPromptVersion") {
      const next = this._normalizeMetadataTag(target.value, this._app.ai.options.metadataPromptVersion || "v1");
      let changed = false;
      if (this._app.ai.options.metadataPromptVersion !== next) {
        this._app.ai.options.metadataPromptVersion = next;
        changed = true;
      }
      if (next && this._normalizeOptionalTextMode(this._app.ai.options.metadataPromptVersionMode, "auto") !== "custom") {
        this._app.ai.options.metadataPromptVersionMode = "custom";
        changed = true;
        this._addChangesJournal("ai.option", "metadataPromptVersionMode=custom (авто: введено значение)");
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `metadataPromptVersion=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "metadataFrontendBuildMode") {
      const prevMode = this._normalizeOptionalTextMode(this._app.ai.options.metadataFrontendBuildMode || "auto", "auto");
      const next = this._normalizeOptionalTextMode(target.value, this._app.ai.options.metadataFrontendBuildMode || "auto");
      let changed = false;
      if (next === "custom") {
        const current = this._normalizeMetadataTag(this._app.ai.options.metadataFrontendBuild || "", "");
        const asked = promptForCustomValue(
          "Сборка фронтенда (metadata.frontend_build)",
          current,
          "Введите тег сборки (пример: build-2026.02.18).",
        );
        if (asked.canceled) {
          this._renderAiUi();
          return;
        }
        const custom = this._normalizeMetadataTag(asked.value, "");
        if (!custom) {
          this._toast("Сборка фронтенда не задана");
          this._renderAiUi();
          return;
        }
        if (this._app.ai.options.metadataFrontendBuild !== custom) {
          this._app.ai.options.metadataFrontendBuild = custom;
          changed = true;
          this._addChangesJournal("ai.option", `metadataFrontendBuild=${custom}`);
        }
      }
      if (this._app.ai.options.metadataFrontendBuildMode !== next) {
        this._app.ai.options.metadataFrontendBuildMode = next;
        changed = true;
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        if (prevMode !== next) this._addChangesJournal("ai.option", `metadataFrontendBuildMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "metadataFrontendBuild") {
      const next = this._normalizeMetadataTag(target.value, this._app.ai.options.metadataFrontendBuild || "");
      let changed = false;
      if (this._app.ai.options.metadataFrontendBuild !== next) {
        this._app.ai.options.metadataFrontendBuild = next;
        changed = true;
      }
      if (next && this._normalizeOptionalTextMode(this._app.ai.options.metadataFrontendBuildMode, "auto") !== "custom") {
        this._app.ai.options.metadataFrontendBuildMode = "custom";
        changed = true;
        this._addChangesJournal("ai.option", "metadataFrontendBuildMode=custom (авто: введено значение)");
      }
      if (changed) {
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `metadataFrontendBuild=${next || "empty"}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "includeSourcesMode") {
      const next = this._normalizeIncludeSourcesMode(target.value, this._app.ai.options.includeSourcesMode || "off");
      if (this._app.ai.options.includeSourcesMode !== next) {
        this._app.ai.options.includeSourcesMode = next;
        markTaskProfileCustom();
        applyReasoningDependencies("includeSourcesMode");
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `includeSourcesMode=${next}`);
      }
      this._renderAiUi();
      return;
    }

    if (reasoningField === "lowBandwidthMode") {
      const next = this._normalizeBooleanSelect(target.value, this._app.ai.options.lowBandwidthMode === true);
      if (this._app.ai.options.lowBandwidthMode !== next) {
        this._app.ai.options.lowBandwidthMode = next;
        markTaskProfileCustom();
        this._app.ai.runtimeProfile = null;
        this._saveAiOptions();
        this._addChangesJournal("ai.option", `lowBandwidthMode=${next ? "on" : "off"}`);
      }
      this._renderAiUi();
      return;
    }
  }

  async onAgentAttachmentsPicked(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const incoming = [];
    for (const file of files) {
      const entry = await this._makeAgentAttachment(file);
      incoming.push(entry);
    }
    this._app.ai.attachments.push(...incoming);
    this._invalidateFileSearchSync();
    this._dom.agentAttachmentInput.value = "";
    this._addChangesJournal("ai.file.attach", `Добавлено файлов: ${incoming.length}`);
    this._renderAiUi();

    const readable = incoming.filter((x) => String(x?.text || "").trim().length > 0).length;
    const failed = incoming.filter((x) => String(x?.parse_error || "").trim()).length;
    const failedPart = failed > 0 ? `, parse errors: ${failed}` : "";
    this._toast(`Файлы прикреплены: ${incoming.length}, readable: ${readable}${failedPart}`);
  }

  _normalizeWebSearchCountry(value, fallback = "RU") {
    const raw = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(raw)) return raw;
    const fb = String(fallback || "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(fb) ? fb : "RU";
  }

  _normalizeWebSearchContextSize(value, fallback = "high") {
    const raw = String(value || "").trim().toLowerCase();
    if (WEB_SEARCH_CONTEXT_SIZE_ORDER.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return WEB_SEARCH_CONTEXT_SIZE_ORDER.includes(fb) ? fb : "high";
  }

  _normalizeReasoningEffort(value, fallback = "medium") {
    const raw = String(value || "").trim().toLowerCase();
    if (REASONING_EFFORT_ORDER.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return REASONING_EFFORT_ORDER.includes(fb) ? fb : "medium";
  }

  _normalizeEnum(value, allowed, fallback) {
    const raw = String(value || "").trim().toLowerCase();
    if (allowed.includes(raw)) return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    return allowed.includes(fb) ? fb : allowed[0];
  }

  _normalizeReasoningDepth(value, fallback = "balanced") {
    return this._normalizeEnum(value, REASONING_DEPTH_ORDER, fallback);
  }

  _normalizeReasoningVerify(value, fallback = "basic") {
    return this._normalizeEnum(value, REASONING_VERIFY_ORDER, fallback);
  }

  _normalizeReasoningSummary(value, fallback = "auto") {
    return this._normalizeEnum(value, REASONING_SUMMARY_ORDER, fallback);
  }

  _normalizeReasoningClarify(value, fallback = "never") {
    return this._normalizeEnum(value, REASONING_CLARIFY_ORDER, fallback);
  }

  _normalizeToolsMode(value, fallback = "auto") {
    return this._normalizeEnum(value, TOOLS_MODE_ORDER, fallback);
  }

  _normalizeBrevityMode(value, fallback = "normal") {
    return this._normalizeEnum(value, BREVITY_MODE_ORDER, fallback);
  }

  _normalizeOutputMode(value, fallback = "bullets") {
    return this._normalizeEnum(value, OUTPUT_MODE_ORDER, fallback);
  }

  _normalizeRiskyActionsMode(value, fallback = "allow_if_asked") {
    return this._normalizeEnum(value, RISKY_ACTIONS_MODE_ORDER, fallback);
  }

  _normalizeStyleMode(value, fallback = "clean") {
    return this._normalizeEnum(value, STYLE_MODE_ORDER, fallback);
  }

  _normalizeCitationsMode(value, fallback = "off") {
    return this._normalizeEnum(value, CITATIONS_MODE_ORDER, fallback);
  }

  _normalizeTaskProfile(value, fallback = "auto") {
    return this._normalizeEnum(value, TASK_PROFILE_ORDER, fallback);
  }

  _taskProfilePreset(profile) {
    const key = this._normalizeTaskProfile(profile, "balanced");
    const preset = TASK_PROFILE_PRESETS[key];
    if (!preset) return null;
    return { ...preset };
  }

  _normalizeReasoningMaxTokens(value, fallback = 0) {
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw <= 0) {
      const fb = Number(fallback);
      return Number.isFinite(fb) && fb > 0 ? Math.max(1, Math.round(fb)) : 0;
    }
    return Math.max(1, Math.round(raw));
  }

  _normalizePromptCacheKey(value, fallback = "") {
    const raw = String(value || "").replace(/\s+/g, " ").trim().slice(0, 240);
    if (raw) return raw;
    return String(fallback || "").replace(/\s+/g, " ").trim().slice(0, 240);
  }

  _normalizePromptCacheRetention(value, fallback = "default") {
    const raw = String(value || "").trim().toLowerCase().slice(0, 64).replace(/_/g, "-");
    if (raw === "default" || raw === "in-memory" || raw === "24h") return raw;
    const fb = String(fallback || "").trim().toLowerCase().slice(0, 64).replace(/_/g, "-");
    if (fb === "default" || fb === "in-memory" || fb === "24h") return fb;
    return "default";
  }

  _normalizeSafetyIdentifier(value, fallback = "") {
    const raw = String(value || "").replace(/\s+/g, " ").trim().slice(0, 240);
    if (raw) return raw;
    return String(fallback || "").replace(/\s+/g, " ").trim().slice(0, 240);
  }

  _normalizeBooleanSelect(value, fallback = false) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "on" || raw === "true" || raw === "1" || raw === "yes") return true;
    if (raw === "off" || raw === "false" || raw === "0" || raw === "no") return false;
    return Boolean(fallback);
  }

  _normalizeBackgroundMode(value, fallback = "auto") {
    return this._normalizeEnum(value, BACKGROUND_MODE_ORDER, fallback);
  }

  _normalizeCompactMode(value, fallback = "off") {
    return this._normalizeEnum(value, COMPACT_MODE_ORDER, fallback);
  }

  _normalizeIncludeSourcesMode(value, fallback = "off") {
    return this._normalizeEnum(value, INCLUDE_SOURCES_MODE_ORDER, fallback);
  }

  _normalizeOptionalTextMode(value, fallback = "auto") {
    return this._normalizeEnum(value, OPTIONAL_TEXT_MODE_ORDER, fallback);
  }

  _normalizeTokenThreshold(value, fallback = 0, min = 1, max = 2000000) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      const fb = Number(fallback);
      if (!Number.isFinite(fb) || fb <= 0) return 0;
      return Math.max(min, Math.min(max, Math.round(fb)));
    }
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  _normalizeTurnThreshold(value, fallback = 0, min = 1, max = 10000) {
    return this._normalizeTokenThreshold(value, fallback, min, max);
  }

  _normalizeMetadataTag(value, fallback = "") {
    const raw = String(value || "").replace(/\s+/g, " ").trim().slice(0, 64);
    if (raw) return raw;
    return String(fallback || "").replace(/\s+/g, " ").trim().slice(0, 64);
  }

  _invalidateFileSearchSync() {
    if (!this._app.ai.fileSearch || typeof this._app.ai.fileSearch !== "object") {
      this._app.ai.fileSearch = { vectorStoreId: "", attachmentsSignature: "", syncedAt: 0 };
      return;
    }
    this._app.ai.fileSearch.vectorStoreId = "";
    this._app.ai.fileSearch.attachmentsSignature = "";
    this._app.ai.fileSearch.syncedAt = 0;
  }

  async _makeAgentAttachment(file) {
    const name = String(file.name || "file");
    const type = String(file.type || "application/octet-stream");
    let text = "";
    let truncated = false;
    let parser = "";
    let parseError = "";

    if (this._isExcelAttachment(name, type)) {
      const parsedExcel = await this._extractExcelText(file);
      text = parsedExcel.text;
      truncated = parsedExcel.truncated;
      parser = parsedExcel.parser;
      parseError = parsedExcel.error;
    } else if (this._isTextAttachment(name, type)) {
      const parsedText = await this._extractText(file, TEXT_ATTACHMENT_MAX_CHARS);
      text = parsedText.text;
      truncated = parsedText.truncated;
      parser = parsedText.parser;
      parseError = parsedText.error;
    }

    return {
      id: this._createId(),
      name,
      size: this._num(file.size, 0),
      type,
      text,
      truncated,
      parser,
      parse_error: parseError,
    };
  }

  _isTextAttachment(name, type) {
    return /^text\//i.test(type) || TEXT_ATTACHMENT_EXT_RE.test(name);
  }

  _isExcelAttachment(name, type) {
    return EXCEL_ATTACHMENT_EXT_RE.test(name) || EXCEL_ATTACHMENT_TYPE_RE.test(type);
  }

  async _extractText(file, maxChars) {
    try {
      const raw = await file.text();
      return this._clipText(raw, maxChars, "text");
    } catch (err) {
      return {
        text: "",
        truncated: false,
        parser: "",
        error: String(err?.message || "attachment text read failed"),
      };
    }
  }

  async _extractExcelText(file) {
    const excelJs = globalThis?.ExcelJS;
    if (!excelJs || typeof excelJs.Workbook !== "function") {
      return { text: "", truncated: false, parser: "", error: "ExcelJS is unavailable" };
    }

    try {
      const workbook = new excelJs.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const worksheets = Array.isArray(workbook.worksheets) ? workbook.worksheets : [];
      if (!worksheets.length) return { text: "", truncated: false, parser: "exceljs", error: "" };

      const lines = [];
      let charCount = 0;
      let truncated = false;

      const pushLine = (lineRaw = "") => {
        if (truncated) return;
        const line = String(lineRaw);
        const projected = charCount + line.length + 1;
        if (projected > EXCEL_ATTACHMENT_MAX_CHARS) {
          const rest = Math.max(0, EXCEL_ATTACHMENT_MAX_CHARS - charCount - 1);
          if (rest > 0) lines.push(line.slice(0, rest));
          truncated = true;
          return;
        }
        lines.push(line);
        charCount = projected;
      };

      for (let sIdx = 0; sIdx < worksheets.length; sIdx += 1) {
        if (sIdx >= EXCEL_ATTACHMENT_MAX_SHEETS) {
          pushLine(`[trimmed sheets <= ${EXCEL_ATTACHMENT_MAX_SHEETS}]`);
          truncated = true;
          break;
        }

        const ws = worksheets[sIdx];
        const sheetName = String(ws?.name || `Sheet${sIdx + 1}`);
        pushLine(`Sheet: ${sheetName}`);

        const rowCount = Math.max(0, Number(ws?.rowCount || 0));
        const colCount = Math.max(0, Number(ws?.columnCount || 0));
        if (rowCount <= 0 || colCount <= 0) {
          pushLine("[empty]");
          if (sIdx + 1 < worksheets.length) pushLine("");
          continue;
        }

        const rows = Math.min(EXCEL_ATTACHMENT_MAX_ROWS, rowCount);
        const cols = Math.min(EXCEL_ATTACHMENT_MAX_COLS, colCount);
        pushLine(new Array(cols).fill(0).map((_, i) => this._colName(i + 1)).join("\t"));

        for (let r = 1; r <= rows; r += 1) {
          const row = ws.getRow(r);
          const values = [];
          for (let c = 1; c <= cols; c += 1) {
            const cellValue = row.getCell(c)?.value;
            values.push(this._excelCellText(cellValue));
          }
          pushLine(values.join("\t"));
          if (truncated) break;
        }

        if (!truncated && (rowCount > rows || colCount > cols)) {
          pushLine(`[trimmed rows <= ${rows}, cols <= ${cols}]`);
        }
        if (!truncated && sIdx + 1 < worksheets.length) pushLine("");
      }

      const text = lines.join("\n");
      return {
        text,
        truncated,
        parser: "exceljs",
        error: "",
      };
    } catch (err) {
      return {
        text: "",
        truncated: false,
        parser: "",
        error: String(err?.message || "excel parse failed"),
      };
    }
  }

  _clipText(raw, maxChars, parser = "") {
    const src = String(raw || "");
    const text = src.slice(0, maxChars);
    return {
      text,
      truncated: src.length > maxChars,
      parser,
      error: "",
    };
  }

  _excelCellText(value) {
    if (value === null || value === undefined) return "";

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return this._sanitizeCellText(String(value));
    }
    if (value instanceof Date) {
      return this._sanitizeCellText(value.toISOString());
    }
    if (typeof value !== "object") {
      return this._sanitizeCellText(String(value));
    }

    if (Array.isArray(value?.richText)) {
      const text = value.richText.map((part) => String(part?.text || "")).join("");
      return this._sanitizeCellText(text);
    }

    if (value?.formula !== undefined) {
      const formula = String(value.formula || "").trim();
      const result = value?.result !== undefined ? this._excelCellText(value.result) : "";
      if (result && formula) return this._sanitizeCellText(`${result} (= ${formula})`);
      if (formula) return this._sanitizeCellText(`=${formula}`);
      return this._sanitizeCellText(result);
    }

    if (value?.hyperlink) {
      const text = String(value?.text || "").trim();
      const link = String(value.hyperlink || "").trim();
      return this._sanitizeCellText(text || link);
    }

    if (value?.text !== undefined) {
      return this._sanitizeCellText(String(value.text || ""));
    }

    if (value?.result !== undefined) {
      return this._excelCellText(value.result);
    }

    if (value?.error) {
      return this._sanitizeCellText(String(value.error));
    }

    try {
      return this._sanitizeCellText(JSON.stringify(value));
    } catch {
      return "";
    }
  }

  _sanitizeCellText(textRaw) {
    return String(textRaw || "")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, ATTACHMENT_CELL_MAX_CHARS);
  }

  _colName(col) {
    let n = Number(col);
    let out = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      out = String.fromCharCode(65 + r) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out || "A";
  }
}
