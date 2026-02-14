export class SheetCellStyler {
  applyCellStyle(element, style, zoom, ptToPx) {
    if (!style) {
      return;
    }

    this.applyFont(element, style.font, zoom, ptToPx);
    this.applyAlignment(element, style.alignment);
    this.applyFill(element, style.fill);
    this.applyBorderSet(element, style.border);
  }

  applyFont(element, font, zoom, ptToPx) {
    if (!font) {
      return;
    }

    if (font.name) {
      element.style.fontFamily = font.name;
    }

    if (typeof font.sizePt === "number") {
      element.style.fontSize = `${Math.max(8, Math.round(ptToPx(font.sizePt) * zoom))}px`;
    }

    if (font.bold) {
      element.style.fontWeight = "700";
    }

    if (font.italic) {
      element.style.fontStyle = "italic";
    }

    if (font.underline) {
      element.style.textDecoration = "underline";
    }

    const fontColor = this.excelColorToCss(font.color);
    if (fontColor) {
      element.style.color = fontColor;
    }
  }

  applyAlignment(element, alignment) {
    if (!alignment) {
      return;
    }

    if (alignment.horizontal) {
      const horizontal = this.normalizeHorizontal(alignment.horizontal);
      element.style.textAlign = horizontal;
      element.style.justifyContent = this.horizontalToJustify(horizontal);
    }

    if (alignment.vertical) {
      element.style.alignItems = this.verticalToAlign(alignment.vertical);
    }

    if (alignment.wrapText) {
      element.style.whiteSpace = "normal";
    }
  }

  applyFill(element, fill) {
    if (!fill || !fill.fgColor) {
      return;
    }

    const backgroundColor = this.excelColorToCss(fill.fgColor);
    if (backgroundColor) {
      element.style.backgroundColor = backgroundColor;
    }
  }

  applyBorderSet(element, border) {
    if (!border) {
      return;
    }

    this.applyBorder(element, "Top", border.top);
    this.applyBorder(element, "Left", border.left);
    this.applyBorder(element, "Right", border.right);
    this.applyBorder(element, "Bottom", border.bottom);
  }

  applyBorder(element, sideName, sideDef) {
    if (!sideDef || !sideDef.style) {
      return;
    }

    const cssWidth = this.borderStyleToWidth(sideDef.style);
    const cssStyle = this.borderStyleToCss(sideDef.style);
    const cssColor = this.excelColorToCss(sideDef.color) || "#8e8e8e";

    element.style[`border${sideName}`] = `${cssWidth}px ${cssStyle} ${cssColor}`;
  }

  borderStyleToWidth(style) {
    if (style === "thick") {
      return 2;
    }

    if (style === "medium") {
      return 1.5;
    }

    return 1;
  }

  borderStyleToCss(style) {
    if (["dashed", "dashDot", "dashDotDot"].includes(style)) {
      return "dashed";
    }

    if (style === "dotted") {
      return "dotted";
    }

    return "solid";
  }

  normalizeHorizontal(horizontal) {
    if (horizontal === "center" || horizontal === "fill" || horizontal === "distributed") {
      return "center";
    }

    if (horizontal === "right") {
      return "right";
    }

    return "left";
  }

  horizontalToJustify(horizontal) {
    if (horizontal === "center") {
      return "center";
    }

    if (horizontal === "right") {
      return "flex-end";
    }

    return "flex-start";
  }

  verticalToAlign(vertical) {
    if (vertical === "middle" || vertical === "center") {
      return "center";
    }

    if (vertical === "bottom") {
      return "flex-end";
    }

    return "flex-start";
  }

  excelColorToCss(color) {
    if (!color || !color.argb) {
      return null;
    }

    const raw = color.argb.replace("#", "");

    if (raw.length === 8) {
      const alpha = parseInt(raw.slice(0, 2), 16) / 255;
      const r = parseInt(raw.slice(2, 4), 16);
      const g = parseInt(raw.slice(4, 6), 16);
      const b = parseInt(raw.slice(6, 8), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    }

    if (raw.length === 6) {
      return `#${raw}`;
    }

    return null;
  }
}
