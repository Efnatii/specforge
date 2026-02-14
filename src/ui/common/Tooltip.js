export class Tooltip {
  static wrap(target, { text = "", hotkey = "" } = {}) {
    const anchor = document.createElement("span");
    anchor.className = "tooltip-anchor";
    anchor.tabIndex = -1;

    const tooltip = document.createElement("span");
    tooltip.className = "tooltip";

    const main = document.createElement("span");
    main.className = "tooltip-text";
    main.textContent = text;
    tooltip.appendChild(main);

    if (hotkey) {
      const key = document.createElement("span");
      key.className = "kbd-hint";
      key.textContent = hotkey;
      tooltip.appendChild(key);
    }

    anchor.append(target, tooltip);
    return anchor;
  }
}
