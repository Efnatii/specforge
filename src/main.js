window.__SPEC_FORGE_BOOT_OK__ = true;

import "./styles.css";
import "./styles/cad-theme.css";
import { App } from "./app/App.js";

const root = document.querySelector("#app");
const app = new App(root);

app.start();
