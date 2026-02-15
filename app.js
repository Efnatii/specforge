import { AppCompositionModule } from "./src/modules/app/composition/root.js";
import { AppDomModule } from "./src/modules/app/core/dom.js";
import { APP_CONFIG } from "./src/config/appConfig.js";

const STARTUP_FLAG = "__SPECFORGE_STARTED__";
const ERROR_OVERLAY_ID = "specforgeFatalError";

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
};

const renderFatalError = (error, context = "startup") => {
  const message = error instanceof Error ? (error.stack || error.message) : String(error);
  // eslint-disable-next-line no-console
  console.error("[SpecForge] Fatal error:", context, error);

  const existing = document.getElementById(ERROR_OVERLAY_ID);
  const overlay = existing || document.createElement("div");
  overlay.id = ERROR_OVERLAY_ID;
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "background:rgba(10,10,10,0.85)",
    "color:#f5f5f5",
    "font:14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "display:flex",
    "align-items:flex-start",
    "justify-content:center",
    "padding:40px",
    "z-index:9999",
  ].join(";");

  const hint = "Приложение не запустилось. Проверьте доступность ./assets и ./src, " +
    "а если открываете файл локально — запустите его через локальный сервер.";

  overlay.innerHTML = [
    "<div style=\"max-width:900px; background:#1c1c1c; border:1px solid #444; border-radius:8px; padding:24px;\">",
    "<h2 style=\"margin:0 0 12px; font-size:18px;\">Ошибка запуска SpecForge</h2>",
    `<p style="margin:0 0 12px;">${escapeHtml(hint)}</p>`,
    `<pre style="margin:0; white-space:pre-wrap; color:#e6a8a8;">${escapeHtml(message)}</pre>`,
    "</div>",
  ].join("");

  if (!existing) document.body.appendChild(overlay);
};

window.addEventListener("error", (event) => {
  renderFatalError(event.error || event.message || "Unknown error", "window.error");
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatalError(event.reason || "Unhandled promise rejection", "window.unhandledrejection");
});

const appDomModule = new AppDomModule({
  documentRef: document,
});

const startApp = async () => {
  const appCompositionModule = new AppCompositionModule({
    dom: appDomModule.createDomRefs(),
    config: APP_CONFIG,
    windowRef: window,
    documentRef: document,
    fetchFn: (...args) => fetch(...args),
  });

  await appCompositionModule.start();
  window[STARTUP_FLAG] = true;
  const overlay = document.getElementById("specforgeStartupFallback");
  if (overlay) overlay.remove();
};

startApp().catch((err) => {
  renderFatalError(err, "startApp");
});
