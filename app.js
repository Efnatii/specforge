import { AppCompositionModule } from "./src/modules/app/composition/root.js";
import { AppDomModule } from "./src/modules/app/core/dom.js";
import { APP_CONFIG } from "./src/config/appConfig.js";

const appDomModule = new AppDomModule({
  documentRef: document,
});

const appCompositionModule = new AppCompositionModule({
  dom: appDomModule.createDomRefs(),
  config: APP_CONFIG,
  windowRef: window,
  documentRef: document,
  fetchFn: (...args) => fetch(...args),
});

appCompositionModule.start().catch(() => {});
