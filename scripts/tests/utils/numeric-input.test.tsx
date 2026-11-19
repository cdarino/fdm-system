import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Input, type InputProps } from "@/components/ui/input";

type RenderableInput = {
  render: (
    props: InputProps,
    ref: React.Ref<HTMLInputElement> | null
  ) => React.ReactElement<{
    onKeyDown?: (e: unknown) => void;
    onPaste?: (e: unknown) => void;
    onWheel?: (e: unknown) => void;
  }>;
};

const inputRenderer = Input as unknown as RenderableInput;

describe("Input component numeric guards", () => {
  it("renders with numeric inputMode when step=1", () => {
    const html = renderToStaticMarkup(<Input type="number" step={1} />);
    expect(html).toContain('inputMode="numeric"');
  });

  it("renders with decimal inputMode when step is not 1", () => {
    const html = renderToStaticMarkup(<Input type="number" step="0.01" />);
    expect(html).toContain('inputMode="decimal"');
  });

  it("respects explicit allowDecimals=false", () => {
    const html = renderToStaticMarkup(<Input type="number" allowDecimals={false} />);
    expect(html).toContain('inputMode="numeric"');
  });

  it("blocks letters including 'e', 'E', and symbols on keydown", () => {
    let preventDefaultCalled = false;
    const preventDefault = () => {
      preventDefaultCalled = true;
    };

    const element = inputRenderer.render(
      {
        type: "number",
        step: 1,
      },
      null
    );

    const onKeyDown = element.props.onKeyDown;
    expect(typeof onKeyDown).toBe("function");

    // Test 'e'
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "e",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Test 'E'
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "E",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Test letter 'a'
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "a",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Test '+'
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "+",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Test '-' when min >= 0 or default
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "-",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Test '.' when step=1 (integers)
    preventDefaultCalled = false;
    onKeyDown?.({
      key: ".",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Test allowed digit '5'
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "5",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(false);

    // Test allowed navigation key 'Backspace'
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "Backspace",
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(false);

    // Test allowed shortcut 'Ctrl+V'
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "v",
      ctrlKey: true,
      currentTarget: { value: "10" },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(false);
  });

  it("allows single decimal point on decimal inputs and blocks second decimal point", () => {
    let preventDefaultCalled = false;
    const preventDefault = () => {
      preventDefaultCalled = true;
    };

    const decimalElement = inputRenderer.render(
      {
        type: "number",
        step: "0.01",
      },
      null
    );

    const onKeyDown = decimalElement.props.onKeyDown;

    // First decimal point when value is "10" -> allowed
    preventDefaultCalled = false;
    onKeyDown?.({
      key: ".",
      currentTarget: { value: "10", selectionStart: 2, selectionEnd: 2 },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(false);

    // Second decimal point when value already has "." -> blocked
    preventDefaultCalled = false;
    onKeyDown?.({
      key: ".",
      currentTarget: { value: "10.5", selectionStart: 4, selectionEnd: 4 },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);
  });

  it("allows negative sign when allowNegative is true and at start", () => {
    let preventDefaultCalled = false;
    const preventDefault = () => {
      preventDefaultCalled = true;
    };

    const element = inputRenderer.render(
      {
        type: "number",
        allowNegative: true,
      },
      null
    );

    const onKeyDown = element.props.onKeyDown;

    // At position 0 -> allowed
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "-",
      currentTarget: { value: "", selectionStart: 0, selectionEnd: 0 },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(false);

    // At position > 0 -> blocked
    preventDefaultCalled = false;
    onKeyDown?.({
      key: "-",
      currentTarget: { value: "10", selectionStart: 2, selectionEnd: 2 },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);
  });

  it("handles paste sanitization and rejection properly", () => {
    let preventDefaultCalled = false;
    const preventDefault = () => {
      preventDefaultCalled = true;
    };

    const element = inputRenderer.render(
      {
        type: "number",
        step: "0.01",
      },
      null
    );

    const onPaste = element.props.onPaste;

    // Pasting invalid text with letters e.g. "abc12" -> blocked
    preventDefaultCalled = false;
    onPaste?.({
      clipboardData: {
        getData: () => "abc12",
      },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Pasting scientific notation e.g. "1e5" -> blocked
    preventDefaultCalled = false;
    onPaste?.({
      clipboardData: {
        getData: () => "1e5",
      },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(true);

    // Pasting clean number "1250.50" -> allowed
    preventDefaultCalled = false;
    onPaste?.({
      clipboardData: {
        getData: () => "1250.50",
      },
      preventDefault,
    });
    expect(preventDefaultCalled).toBe(false);
  });

  it("blurs input on mouse wheel to prevent accidental scrolling changes", () => {
    let blurCalled = false;
    const element = inputRenderer.render(
      {
        type: "number",
      },
      null
    );

    element.props.onWheel?.({
      currentTarget: {
        blur: () => {
          blurCalled = true;
        },
      },
    });
    expect(blurCalled).toBe(true);
  });

  it("preserves caller custom onKeyDown handler", () => {
    let customCalled = false;
    const element = inputRenderer.render(
      {
        type: "number",
        onKeyDown: () => {
          customCalled = true;
        },
      },
      null
    );

    element.props.onKeyDown?.({
      key: "5",
      currentTarget: { value: "10" },
      preventDefault: () => {},
    });
    expect(customCalled).toBe(true);
  });
});
