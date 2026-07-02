import { describe, it, expect, vi, beforeEach } from "vitest";
import { styleError, styleSuccess, styleMuted, styleAccent, styleWarning, styleText } from "../extensions/utils/render-utils";

describe("Render Utils Stylers (inline)", () => {
  let theme: any;

  beforeEach(() => {
    theme = { fg: (color: string, text: string) => `[${color}]${text}` };
  });

  it("styleError returns error-styled string", () => {
    expect(styleError(theme, "fail")).toBe("[error]fail");
  });

  it("styleSuccess returns success-styled string", () => {
    expect(styleSuccess(theme, "ok")).toBe("[success]ok");
  });

  it("styleMuted returns muted-styled string", () => {
    expect(styleMuted(theme, "dim")).toBe("[muted]dim");
  });

  it("styleAccent returns accent-styled string", () => {
    expect(styleAccent(theme, "highlight")).toBe("[accent]highlight");
  });

  it("styleWarning returns warning-styled string", () => {
    expect(styleWarning(theme, "warn")).toBe("[warning]warn");
  });

  it("styleText returns text-styled string", () => {
    expect(styleText(theme, "normal")).toBe("[text]normal");
  });
});
