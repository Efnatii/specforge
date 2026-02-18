export class OpenAiAuthModule {
  constructor({
    app,
    dom,
    aiModels,
    defaultModel,
    fetchFn,
    windowRef,
    isKnownAiModel,
    renderOpenAiModelOptions,
    renderOpenAiModelPrice,
    saveOpenAiApiKey,
    saveOpenAiModel,
    saveAiOptions,
    addChangesJournal,
    addExternalJournal,
    renderAiUi,
    toast,
  }) {
    if (!app) throw new Error("OpenAiAuthModule requires app");
    if (!dom) throw new Error("OpenAiAuthModule requires dom");
    if (!Array.isArray(aiModels)) throw new Error("OpenAiAuthModule requires aiModels");
    if (!defaultModel) throw new Error("OpenAiAuthModule requires defaultModel");
    if (typeof fetchFn !== "function") throw new Error("OpenAiAuthModule requires fetchFn()");
    if (!windowRef) throw new Error("OpenAiAuthModule requires windowRef");
    if (typeof isKnownAiModel !== "function") throw new Error("OpenAiAuthModule requires isKnownAiModel()");
    if (typeof renderOpenAiModelOptions !== "function") throw new Error("OpenAiAuthModule requires renderOpenAiModelOptions()");
    if (typeof renderOpenAiModelPrice !== "function") throw new Error("OpenAiAuthModule requires renderOpenAiModelPrice()");
    if (typeof saveOpenAiApiKey !== "function") throw new Error("OpenAiAuthModule requires saveOpenAiApiKey()");
    if (typeof saveOpenAiModel !== "function") throw new Error("OpenAiAuthModule requires saveOpenAiModel()");
    if (typeof saveAiOptions !== "function") throw new Error("OpenAiAuthModule requires saveAiOptions()");
    if (typeof addChangesJournal !== "function") throw new Error("OpenAiAuthModule requires addChangesJournal()");
    if (typeof addExternalJournal !== "function") throw new Error("OpenAiAuthModule requires addExternalJournal()");
    if (typeof renderAiUi !== "function") throw new Error("OpenAiAuthModule requires renderAiUi()");
    if (typeof toast !== "function") throw new Error("OpenAiAuthModule requires toast()");

    this._app = app;
    this._dom = dom;
    this._aiModels = aiModels;
    this._defaultModel = defaultModel;
    this._fetch = fetchFn;
    this._window = windowRef;
    this._isKnownAiModel = isKnownAiModel;
    this._renderOpenAiModelOptions = renderOpenAiModelOptions;
    this._renderOpenAiModelPrice = renderOpenAiModelPrice;
    this._saveOpenAiApiKey = saveOpenAiApiKey;
    this._saveOpenAiModel = saveOpenAiModel;
    this._saveAiOptions = saveAiOptions;
    this._addChangesJournal = addChangesJournal;
    this._addExternalJournal = addExternalJournal;
    this._renderAiUi = renderAiUi;
    this._toast = toast;
  }

  async onOpenAiAuthClick() {
    if (
      !this._dom.openAiAuthDialog
      || typeof this._dom.openAiAuthDialog.showModal !== "function"
      || !this._dom.openAiApiKeyInput
      || !this._dom.openAiAuthHint
      || !this._dom.btnOpenAiDisconnect
      || !this._dom.btnOpenAiSave
      || !this._dom.openAiModelSelect
    ) {
      const key = this._window.prompt("Введите OpenAI API key (формат sk-...)");
      if (key === null) return;
      await this.connectOpenAiWithKey(key, this._app.ai.model, this._app?.ai?.options?.serviceTier || "standard");
      return;
    }

    this._renderOpenAiModelOptions();
    if (this._dom.openAiModelSelect) {
      this._selectModelOption(this._app.ai.model, this._app?.ai?.options?.serviceTier || "standard");
    }
    this._renderOpenAiModelPrice();
    this._dom.openAiApiKeyInput.value = "";
    this._dom.openAiAuthHint.textContent = this._app.ai.connected
      ? "Ключ уже сохранен. Можно заменить ключ и/или модель."
      : "Введите OpenAI API key, выберите модель и нажмите Сохранить.";
    this._dom.btnOpenAiDisconnect.hidden = !this._app.ai.connected;
    this._dom.btnOpenAiSave.disabled = false;
    this._dom.openAiAuthDialog.showModal();
  }

  async onOpenAiAuthSubmit(e) {
    e.preventDefault();
    if (String(e.submitter?.value || "") === "cancel") {
      this._dom.openAiAuthDialog?.close();
      return;
    }
    if (!this._dom.openAiApiKeyInput) return;

    const selected = this._readModelSelection();
    if (!this._isKnownAiModel(selected.modelId)) {
      this._toast("Выберите корректную модель");
      return;
    }

    const token = String(this._dom.openAiApiKeyInput.value || "").trim();
    if (!token) {
      if (this._app.ai.connected) {
        const tier = this._resolveServiceTierForModel(selected.modelId, selected.serviceTier);
        this._app.ai.model = selected.modelId;
        this._app.ai.options.serviceTier = tier;
        this._saveOpenAiModel();
        this._saveAiOptions();
        this._addChangesJournal("auth.model", `${selected.modelId} [${tier}]`);
        this._dom.openAiAuthDialog.close();
        this._toast("Настройки сохранены");
        return;
      }
      this._toast("Введите API key");
      return;
    }

    if (this._dom.btnOpenAiSave) this._dom.btnOpenAiSave.disabled = true;
    const ok = await this.connectOpenAiWithKey(token, selected.modelId, selected.serviceTier);
    if (this._dom.btnOpenAiSave) this._dom.btnOpenAiSave.disabled = false;
    if (ok && this._dom.openAiAuthDialog?.open) this._dom.openAiAuthDialog.close();
  }

  async connectOpenAiWithKey(token, modelId = this._defaultModel, serviceTier = "standard") {
    const clean = String(token || "").trim();
    if (!clean) {
      this._toast("Ключ не введен");
      return false;
    }

    const model = this._isKnownAiModel(modelId) ? modelId : this._defaultModel;
    const tier = this._normalizeServiceTier(serviceTier, "standard");
    const verified = await this._verifyOpenAiApiKey(clean);
    if (!verified.ok) {
      this._toast(verified.error || "OpenAI: ключ не принят");
      return false;
    }

    let finalModel = model;
    if (Array.isArray(verified.modelIds) && verified.modelIds.length && !verified.modelIds.includes(finalModel)) {
      const preferred = this._aiModels.map((m) => m.id).find((id) => verified.modelIds.includes(id));
      if (preferred) {
        this._addExternalJournal("auth.model.fallback", `Модель ${finalModel} недоступна, выбрана ${preferred}`);
        finalModel = preferred;
      }
    }

    const finalTier = this._resolveServiceTierForModel(finalModel, tier);

    this._app.ai.apiKey = clean;
    this._app.ai.model = finalModel;
    this._app.ai.options.serviceTier = finalTier;
    this._app.ai.connected = true;
    this._saveOpenAiApiKey();
    this._saveOpenAiModel();
    this._saveAiOptions();
    this._addChangesJournal("auth.connect", `${finalModel} [${finalTier}]`);
    this._renderAiUi();
    this._toast("Ключ API сохранен");
    return true;
  }

  _normalizeServiceTier(value, fallback = "standard") {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "flex" || raw === "standard" || raw === "priority") return raw;
    const fb = String(fallback || "").trim().toLowerCase();
    if (fb === "flex" || fb === "standard" || fb === "priority") return fb;
    return "standard";
  }

  _modelMetaById(modelId) {
    const id = String(modelId || "").trim();
    return this._aiModels.find((m) => String(m?.id || "") === id) || null;
  }

  _resolveServiceTierForModel(modelId, desired = "standard") {
    const meta = this._modelMetaById(modelId);
    const preferred = this._normalizeServiceTier(desired, "standard");
    const tiers = Array.isArray(meta?.tiers) ? meta.tiers.map((x) => this._normalizeServiceTier(x, "standard")) : ["standard"];
    if (tiers.includes(preferred)) return preferred;
    if (tiers.includes("standard")) return "standard";
    return tiers[0] || "standard";
  }

  _readModelSelection() {
    const select = this._dom.openAiModelSelect;
    const rawValue = String(select?.value || this._defaultModel).trim();
    const selectedOption = select?.selectedOptions?.[0] || null;
    const splitIdx = rawValue.indexOf("::");
    const parsedModel = splitIdx >= 0 ? rawValue.slice(0, splitIdx) : rawValue;
    const parsedTier = splitIdx >= 0 ? rawValue.slice(splitIdx + 2) : "standard";
    const modelId = String(selectedOption?.dataset?.modelId || parsedModel || this._defaultModel).trim();
    const serviceTier = this._resolveServiceTierForModel(modelId, selectedOption?.dataset?.serviceTier || parsedTier || "standard");
    return { modelId, serviceTier };
  }

  _selectModelOption(modelId, serviceTier = "standard") {
    const select = this._dom.openAiModelSelect;
    if (!select) return;
    const id = this._isKnownAiModel(modelId) ? String(modelId || "").trim() : this._defaultModel;
    const tier = this._resolveServiceTierForModel(id, serviceTier);
    const desired = `${id}::${tier}`;
    if (Array.from(select.options || []).some((o) => String(o.value || "") === desired)) {
      select.value = desired;
      return;
    }
    const fallback = Array.from(select.options || []).find((o) => String(o?.dataset?.modelId || "") === id);
    if (fallback) {
      select.value = String(fallback.value || "");
      return;
    }
    if (select.options && select.options.length) {
      select.value = String(select.options[0].value || "");
    }
  }

  disconnectOpenAi() {
    if (this._app.ai.streamDeltaFlushTimer) {
      this._window.clearTimeout(this._app.ai.streamDeltaFlushTimer);
      this._app.ai.streamDeltaFlushTimer = 0;
    }
    this._app.ai.apiKey = "";
    this._app.ai.connected = false;
    this._app.ai.sending = false;
    this._app.ai.attachments = [];
    this._app.ai.webSearchPopoverOpen = false;
    this._app.ai.reasoningPopoverOpen = false;
    this._app.ai.fileSearch = {
      vectorStoreId: "",
      attachmentsSignature: "",
      syncedAt: 0,
    };
    this._app.ai.streamEntryId = "";
    this._app.ai.streamDeltaHasPending = false;
    this._app.ai.lastStreamBuffer = "";
    this._app.ai.backgroundResponseId = "";
    this._app.ai.backgroundActive = false;
    this._app.ai.backgroundPollCount = 0;
    this._app.ai.cancelApiRequestedFor = "";
    this._app.ai.pendingCancelResponseIds = [];
    this._app.ai.cancelRequested = false;
    this._app.ai.activeRequestAbort = null;
    this._app.ai.conversationId = "";
    this._app.ai.lastCompletedResponseId = "";
    this._app.ai.lastCompactedResponseId = "";
    this._app.ai.serviceTierActual = "";
    this._addExternalJournal("auth", "Ключ OpenAI отключен");
    this._addChangesJournal("auth.disconnect", "manual");
    this._saveOpenAiApiKey();
    this._renderAiUi();
    this._toast("OpenAI отключен");
  }

  async _verifyOpenAiApiKey(key) {
    const startedAt = Date.now();
    this._addExternalJournal("auth.request", "GET /v1/models (проверка API key)");
    try {
      const res = await this._fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });
      const ms = Date.now() - startedAt;
      this._addExternalJournal("auth.response", `HTTP ${res.status} /v1/models (${ms}ms)`);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const ids = Array.isArray(body?.data)
          ? body.data.map((m) => String(m?.id || "").trim()).filter(Boolean)
          : [];
        return { ok: true, modelIds: ids };
      }
      if (res.status === 401 || res.status === 403) return { ok: false, error: "OpenAI: неверный ключ" };
      return { ok: false, error: `OpenAI: ошибка ${res.status}` };
    } catch {
      const ms = Date.now() - startedAt;
      this._addExternalJournal("auth.error", `Сетевая ошибка при проверке ключа (${ms}ms)`);
      return { ok: false, error: "OpenAI: сеть недоступна" };
    }
  }
}

