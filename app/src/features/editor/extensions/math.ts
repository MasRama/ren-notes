import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Lines longer than this are prose, not sums. */
const LINE_MAX = 200;

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, π: Math.PI };
const OPERATORS: Record<string, string> = { "−": "-", "×": "*", "·": "*", "÷": "/" };

type Token = { kind: "num"; value: number } | { kind: "name"; name: string } | { kind: "op"; op: string };

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([\p{L}_][\p{L}\p{N}_]*)|([-+*/^%()−×·÷]))/uy;
  let at = 0;
  while (at < text.length) {
    if (/^\s*$/.test(text.slice(at))) break;
    pattern.lastIndex = at;
    const m = pattern.exec(text);
    if (!m) return null;
    at = pattern.lastIndex;
    if (m[1] !== undefined) tokens.push({ kind: "num", value: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ kind: "name", name: m[2] });
    else tokens.push({ kind: "op", op: OPERATORS[m[3]] ?? m[3] });
  }
  return tokens;
}

/** A sum's value, and whether it did any work (an operator, a function or a
 * variable) rather than just repeat a number. */
function parse(text: string, vars: ReadonlyMap<string, number>): { value: number; worked: boolean } | null {
  const tokens = tokenize(text);
  if (!tokens?.length) return null;
  let i = 0;
  let worked = false;
  const isOp = (op: string) => {
    const t = tokens[i];
    return t?.kind === "op" && t.op === op;
  };
  const fail = (): never => {
    throw new SyntaxError();
  };

  const sum = (): number => {
    let value = product();
    while (isOp("+") || isOp("-")) {
      worked = true;
      const plus = isOp("+");
      i++;
      value = plus ? value + product() : value - product();
    }
    return value;
  };
  const product = (): number => {
    let value = unary();
    while (isOp("*") || isOp("/")) {
      worked = true;
      const times = isOp("*");
      i++;
      value = times ? value * unary() : value / unary();
    }
    return value;
  };
  const unary = (): number => {
    if (isOp("-") || isOp("+")) {
      const minus = isOp("-");
      i++;
      return minus ? -unary() : unary();
    }
    return power();
  };
  const power = (): number => {
    const base = percent();
    if (!isOp("^")) return base;
    worked = true;
    i++;
    return base ** unary();
  };
  const percent = (): number => {
    let value = primary();
    while (isOp("%")) {
      worked = true;
      i++;
      value /= 100;
    }
    return value;
  };
  const primary = (): number => {
    const t = tokens[i++];
    if (!t) return fail();
    if (t.kind === "num") return t.value;
    if (t.kind === "op") {
      if (t.op !== "(") return fail();
      const value = sum();
      if (!isOp(")")) return fail();
      i++;
      return value;
    }
    if (isOp("(") && FUNCTIONS[t.name.toLowerCase()]) {
      worked = true;
      i++;
      const value = FUNCTIONS[t.name.toLowerCase()](sum());
      if (!isOp(")")) return fail();
      i++;
      return value;
    }
    worked = true;
    const value = vars.get(t.name) ?? CONSTANTS[t.name.toLowerCase()];
    return value ?? fail();
  };

  try {
    const value = sum();
    if (i !== tokens.length || !Number.isFinite(value)) return null;
    return { value, worked };
  } catch {
    return null;
  }
}

/** The value of a sum such as `2 * (rent + 15%)`, or null when it is not one
 * or has no finite answer. */
export function evaluate(text: string, vars: ReadonlyMap<string, number>): number | null {
  return parse(text, vars)?.value ?? null;
}

/** An answer as the note shows it: thousands grouped, float noise gone. */
export function formatNumber(value: number): string {
  const text = value.toLocaleString("en-US", { maximumFractionDigits: 10 });
  return text === "-0" ? "0" : text;
}

const ASSIGNMENT = /^([\p{L}_][\p{L}\p{N}_]*)\s*=\s*([^=]+?)\s*(=)?$/u;

/** The longest sum that ends `body`, so words before it are skipped. */
function trailingSum(body: string, vars: ReadonlyMap<string, number>): number | null {
  for (let i = 0; i < body.length; i++) {
    if (/\s/.test(body[i]) || (i > 0 && /[\p{L}\p{N}_.]/u.test(body[i - 1]))) continue;
    const found = parse(body.slice(i), vars);
    if (found) return found.worked ? found.value : null;
  }
  return null;
}

/** Each line's answer, as Math Notes on the Mac gives them: a line ending in
 * `=` is worked out, and `name = sum` sets a variable for the lines below. */
export function solveLines(lines: readonly string[]): (number | null)[] {
  const vars = new Map<string, number>();
  return lines.map((line) => {
    const text = line.trim();
    if (!text.includes("=") || text.length > LINE_MAX) return null;
    const assignment = ASSIGNMENT.exec(text);
    if (assignment) {
      const value = evaluate(assignment[2], vars);
      if (value === null) return null;
      vars.set(assignment[1], value);
      return assignment[3] ? value : null;
    }
    if (!text.endsWith("=")) return null;
    const body = text.slice(0, -1);
    return trailingSum(body.slice(body.lastIndexOf("=") + 1), vars);
  });
}

interface Line {
  text: string;
  /** The position just after the line's last `=`. */
  end: number;
}

function linesOf(doc: PMNode): Line[] {
  const lines: Line[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.spec.code) return false;
    // One character per inline leaf keeps text offsets equal to positions.
    const text = node.textBetween(0, node.content.size, undefined, (leaf) =>
      leaf.type.name === "hardBreak" ? "\n" : "￼",
    );
    let start = 0;
    for (const part of text.split("\n")) {
      lines.push({ text: part, end: pos + 1 + start + part.lastIndexOf("=") + 1 });
      start += part.length + 1;
    }
    return false;
  });
  return lines;
}

function decorate(doc: PMNode): DecorationSet {
  const lines = linesOf(doc);
  const decorations: Decoration[] = [];
  solveLines(lines.map((l) => l.text)).forEach((value, n) => {
    if (value === null) return;
    // Drawn by CSS after the = itself, so the line holds no uneditable
    // widget for the caret to stop at.
    const { end } = lines[n];
    decorations.push(
      Decoration.inline(end - 1, end, { class: "rn-math-result", "data-result": formatNumber(value) }),
    );
  });
  return DecorationSet.create(doc, decorations);
}

const key = new PluginKey<DecorationSet>("mathResults");

/** Math Notes: answers appear after sums as they are typed. They are shown,
 * not written into the note, so they follow every change above them. */
export const MathResults = Extension.create({
  name: "mathResults",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => decorate(state.doc),
          apply: (tr, old, _o, state) => (tr.docChanged ? decorate(state.doc) : old),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});
