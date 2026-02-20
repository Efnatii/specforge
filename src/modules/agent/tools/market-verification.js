const MARKET_MAIN_PATH_RE = /^assemblies\[\d+\]\.(main|consumable)\[\d+\]\.(schematic|name|manufacturer|article|qty|unit|priceCatalogVatMarkup|markup|discount|supplier|note)$/;
const MARKET_PROJECT_PATH_RE = /^projectConsumables\[\d+\]\.(schematic|name|manufacturer|article|qty|unit|priceCatalogVatMarkup|markup|discount|supplier|note)$/;

export class MarketVerificationModule {
  constructor({ config, deps }) {
    if (!config) throw new Error("MarketVerificationModule requires config");
    if (!deps) throw new Error("MarketVerificationModule requires deps");

    const { minSources, maxSources, marketFields } = config;
    const {
      getMinSources,
      getAttachments,
      isWebSearchEnabled,
      normalizeHttpUrl,
      addTableJournal,
    } = deps;

    if (!Number.isFinite(minSources) || minSources < 1) throw new Error("MarketVerificationModule requires config.minSources");
    if (!Number.isFinite(maxSources) || maxSources < minSources) throw new Error("MarketVerificationModule requires config.maxSources");
    if (!marketFields || typeof marketFields[Symbol.iterator] !== "function") throw new Error("MarketVerificationModule requires config.marketFields");

    if (getMinSources !== undefined && typeof getMinSources !== "function") {
      throw new Error("MarketVerificationModule deps.getMinSources must be a function");
    }
    if (typeof getAttachments !== "function") throw new Error("MarketVerificationModule requires deps.getAttachments()");
    if (typeof isWebSearchEnabled !== "function") throw new Error("MarketVerificationModule requires deps.isWebSearchEnabled()");
    if (typeof normalizeHttpUrl !== "function") throw new Error("MarketVerificationModule requires deps.normalizeHttpUrl()");
    if (typeof addTableJournal !== "function") throw new Error("MarketVerificationModule requires deps.addTableJournal()");

    this._minSourcesDefault = minSources;
    this._maxSources = maxSources;
    this._marketFields = Array.from(marketFields, (v) => String(v));
    this._getMinSources = typeof getMinSources === "function" ? getMinSources : null;
    this._getAttachments = getAttachments;
    this._isWebSearchEnabled = isWebSearchEnabled;
    this._normalizeHttpUrl = normalizeHttpUrl;
    this._addTableJournal = addTableJournal;
  }

  isMarketFieldTouched(args) {
    for (const key of this._marketFields) {
      if (args?.[key] !== undefined) return true;
    }
    return false;
  }

  statePathRequiresMarketVerification(path) {
    const p = String(path || "").trim();
    if (!p) return false;
    if (MARKET_MAIN_PATH_RE.test(p)) return true;
    if (MARKET_PROJECT_PATH_RE.test(p)) return true;
    return false;
  }

  isMarketSheetId(sheetId) {
    const id = String(sheetId || "").trim();
    return id.startsWith("assembly:") || id === "project-consumables";
  }

  ensureMarketVerification(turnCtx, verification, actionLabel) {
    const minSources = this._resolveMinSources();
    const normalized = this._normalizeMarketVerification(verification);
    if (!normalized) {
      const message = `Нужно verification: web (query + минимум ${minSources} URL) или attachments (ссылки на прикрепленные файлы).`;
      this._addTableJournal(actionLabel, `Ошибка: ${message}`);
      return { ok: false, error: message };
    }

    const errors = [];
    const via = [];

    const hasDocs = normalized.attachments.length > 0;
    if (hasDocs) via.push("docs");

    const hasWebPayload = normalized.sources.length > 0 || normalized.query.length > 0;
    let webOk = false;
    if (hasWebPayload) {
      if (!this._isWebSearchEnabled()) {
        errors.push("веб-поиск отключен");
      } else if (!turnCtx?.webSearchUsed) {
        errors.push("в этом ходе не было web_search");
      } else if (!normalized.query || normalized.sources.length < minSources) {
        errors.push(`для web-подтверждения нужен query и минимум ${minSources} URL`);
      } else {
        webOk = true;
        if (Array.isArray(turnCtx.webSearchUrls) && turnCtx.webSearchUrls.length) {
          const turnDomains = new Set(turnCtx.webSearchUrls.map((url) => this._domainOfUrl(url)).filter(Boolean));
          const sourceDomains = new Set(normalized.sources.map((source) => this._domainOfUrl(source.url)).filter(Boolean));
          let hasMatch = false;
          for (const domain of sourceDomains) {
            if (turnDomains.has(domain)) {
              hasMatch = true;
              break;
            }
          }
          if (!hasMatch) {
            webOk = false;
            errors.push("домены verification не совпали с web_search этого хода");
          }
        }
      }
    }

    if (webOk) via.push("web");
    if (!via.length) {
      const message = errors.length ? errors.join("; ") : "подтверждение не прошло";
      this._addTableJournal(actionLabel, `Ошибка: ${message}`);
      return { ok: false, error: message };
    }

    return {
      ok: true,
      verification: {
        query: normalized.query,
        sources: webOk ? normalized.sources : [],
        attachments: normalized.attachments,
        via: via.join("+"),
      },
    };
  }

  _normalizeMarketVerification(rawVerification) {
    if (!rawVerification || typeof rawVerification !== "object") return null;
    const query = String(rawVerification.query || "").replace(/\s+/g, " ").trim();
    const src = Array.isArray(rawVerification.sources) ? rawVerification.sources : [];
    const docs = Array.isArray(rawVerification.attachments) ? rawVerification.attachments : [];
    const seenSources = new Set();
    const seenAttachments = new Set();
    const sources = [];
    const attachments = [];

    for (const entry of src) {
      const title = String(entry?.title || "").replace(/\s+/g, " ").trim();
      const url = this._normalizeHttpUrl(entry?.url || "");
      if (!url || seenSources.has(url)) continue;
      seenSources.add(url);
      sources.push({
        title: title.slice(0, 200),
        url,
      });
      if (sources.length >= this._maxSources) break;
    }

    for (const item of docs) {
      const ref = this._resolveAttachmentVerificationRef(item);
      if (!ref) continue;

      const key = ref.id || ref.name.toLowerCase();
      if (!key || seenAttachments.has(key)) continue;
      seenAttachments.add(key);
      attachments.push({
        id: ref.id,
        name: ref.name,
        excerpt: String(item?.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 300),
      });
      if (attachments.length >= this._maxSources) break;
    }

    if (!query && !sources.length && !attachments.length) return null;
    return { query: query.slice(0, 400), sources, attachments };
  }

  _resolveAttachmentVerificationRef(raw) {
    if (!raw || typeof raw !== "object") return null;
    const attachments = this._safeAttachments();
    const id = String(raw.id || "").trim();
    if (id) {
      const hit = attachments.find((file) => file?.id === id);
      if (hit) return { id: hit.id, name: String(hit.name || "") };
    }

    const name = String(raw.name || "").trim().toLowerCase();
    if (name) {
      const hit = attachments.find((file) => String(file?.name || "").trim().toLowerCase() === name);
      if (hit) return { id: hit.id, name: String(hit.name || "") };
    }

    return null;
  }

  _safeAttachments() {
    const files = this._getAttachments();
    return Array.isArray(files) ? files : [];
  }

  _domainOfUrl(raw) {
    try {
      return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }

  _resolveMinSources() {
    const fallback = Math.max(1, Math.min(this._maxSources, Math.round(Number(this._minSourcesDefault) || 1)));
    if (!this._getMinSources) return fallback;
    const raw = Number(this._getMinSources());
    if (!Number.isFinite(raw)) return fallback;
    return Math.max(1, Math.min(this._maxSources, Math.round(raw)));
  }
}
