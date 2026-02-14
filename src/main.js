import "./styles.css";
import { App } from "./app/App.js";

const root = document.querySelector("#app");
const app = new App(root);

app.start();
