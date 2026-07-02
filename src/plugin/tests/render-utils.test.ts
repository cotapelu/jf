import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderError, renderSuccess, renderMuted, renderAccent } from "../extensions/utils/render-utils";
import { Text } from "@earendil-works/pi-tui";

describe("Render Utils", () => {
  let theme: any;

  beforeEach(() => {
    theme = { fg: (color: string, text: string) => `[${color}]${text}`, bold: (t: string) => `bold(${t})` };
  });

  it("renderError returns Text with error color applied", () => {
    const comp = renderError(theme, "failure");
    expect(comp).toBeInstanceOf(Text);
    // @ts-ignore - Text has text property
    expect(comp.text).toBe("[error]failure");
  });

  it("renderSuccess returns Text with success color", () => {
    const comp = renderSuccess(theme, "ok");
    expect(comp).toBeInstanceOf(Text);
    // @ts-ignore - Text has text property
    expect(comp.text).toBe("[success]ok");
  });

  it("renderMuted returns Text with muted color", () => {
    const comp = renderMuted(theme, "dim");
    expect(comp).toBeInstanceOf(Text);
    // @ts-ignore - Text has text property
    expect(comp.text).toBe("[muted]dim");
  });

  it("renderAccent returns Text with accent color", () => {
    const comp = renderAccent(theme, "highlight");
    expect(comp).toBeInstanceOf(Text);
    // @ts-ignore - Text has text property
    expect(comp.text).toBe("[accent]highlight");
  });
});
