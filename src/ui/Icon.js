const SVG_NS = "http://www.w3.org/2000/svg";
const SPRITE_URL = `${import.meta.env.BASE_URL}assets/icons/lucide-sprite.svg`;
let spriteProbeStarted = false;
const FALLBACK_PATHS = {
  "folder-open": ["M3 6h6l2 2h10v2", "M6 14h12l-1.5 6H4.5L6 14z"],
  upload: ["M12 16V4", "m7 9 5-5 5 5", "M4 20h16"],
  download: ["M12 4v12", "m7 11 5 5 5-5", "M4 20h16"],
  printer: ["M6 9V4h12v5", "M3 9h18v8H3z", "M6 14h12v6H6z"],
  "rotate-ccw": ["M3 2v6h6", "M3.5 13a8.5 8.5 0 1 0 2.5-6"],
  plus: ["M12 5v14", "M5 12h14"],
  search: ["M21 21l-4.3-4.3", "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z"],
  settings: ["M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6", "M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9.2 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.6c.1-.3.1-.7.1-1z"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  columns: ["M3 4h18v16H3z", "M12 4v16"],
  activity: ["M2 12h4l3 8 6-16 3 8h4"],
  "alert-triangle": ["m10.3 3.8-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-14a2 2 0 0 0-3.4 0Z", "M12 9v4", "M12 17h.01"],
  history: ["M3 3v5h5", "M3.1 13a9 9 0 1 0 3-6.7L3 8", "M12 7v5l4 2"],
  x: ["m18 6-12 12", "m6 6 12 12"],
  wand: ["m4 20 16-16", "m14 4 1.5-1.5", "M20 10l1.5-1.5", "m3 9 1.5-1.5"],
  "file-up": ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M12 18v-7", "m9 14 3-3 3 3"],
  "clipboard-import": ["M8 2h8v4H8z", "M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3", "M12 15V9", "m9 12 3 3 3-3"]
};

export function Icon({ name, size = 18, title = "" }) {
  probeSpriteAvailability();

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  if (title) {
    const titleNode = document.createElementNS(SVG_NS, "title");
    titleNode.textContent = title;
    svg.appendChild(titleNode);
  }

  const spriteHref = `${SPRITE_URL}#${name}`;
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", spriteHref);
  svg.appendChild(use);

  const fallback = FALLBACK_PATHS[name];
  if (!fallback) {
    return svg;
  }

  const fallbackGroup = document.createElementNS(SVG_NS, "g");
  fallbackGroup.setAttribute("class", "icon-fallback");
  for (const d of fallback) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    fallbackGroup.appendChild(path);
  }
  svg.appendChild(fallbackGroup);

  return svg;
}

function probeSpriteAvailability() {
  if (spriteProbeStarted || typeof window === "undefined" || !window.fetch) {
    return;
  }

  spriteProbeStarted = true;
  window
    .fetch(SPRITE_URL, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("sprite-not-found");
      }
    })
    .catch(() => {
      document.documentElement.classList.add("icons-sprite-missing");
    });
}
