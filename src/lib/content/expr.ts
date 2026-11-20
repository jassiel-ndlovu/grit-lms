/**
 * A small, safe formula parser for graphs: "2x^2 - 3x + 1", "sin(x)/x",
 * "sqrt(4 - x^2)". It never calls eval or Function; the text is parsed into
 * closures over a fixed set of operators and functions. Pure; runs anywhere.
 *
 * Grammar (whitespace ignored):
 *   expr  := term (("+" | "-") term)*
 *   term  := unary (("*" | "/" | implicit) unary)*      "2x", "3(x+1)", "x sin(x)"
 *   unary := ("-" | "+") unary | power
 *   power := atom ("^" unary)?                            right-associative
 *   atom  := number | "x" | "pi" | "π" | "e" | fn "(" expr ")" | "(" expr ")" | "|" expr "|"
 *
 * A leading "y =" or "f(x) =" is dropped, since tutors type it out of habit.
 */

export type Compiled = (x: number) => number;

const FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, "π": Math.PI, e: Math.E };

export const MAX_EXPR_LENGTH = 120;

type Token = { kind: "num"; value: number; at: number } | { kind: "id"; value: string; at: number } | { kind: "op"; value: string; at: number };

function tokenize(src: string): Token[] | { error: string } {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+(?:[.,]\d+)?|[.,]\d+)/.exec(src.slice(i));
    if (num) {
      out.push({ kind: "num", value: Number(num[1].replace(",", ".")), at: i });
      i += num[1].length;
      continue;
    }
    if (c === "π") {
      out.push({ kind: "id", value: "π", at: i++ });
      continue;
    }
    const id = /^[a-z]+/i.exec(src.slice(i));
    if (id) {
      // Split runs like "xsin" or "2pix" into known names: longest name first.
      let word = id[0].toLowerCase();
      let at = i;
      i += word.length;
      while (word) {
        const name = [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS), "x"]
          .sort((a, b) => b.length - a.length)
          .find((n) => word.startsWith(n));
        if (!name) return { error: `Unknown name "${word}". Use x, pi, e and functions like sin, sqrt or ln.` };
        out.push({ kind: "id", value: name, at });
        word = word.slice(name.length);
        at += name.length;
      }
      continue;
    }
    if (c === "*" && src[i + 1] === "*") {
      out.push({ kind: "op", value: "^", at: i });
      i += 2;
      continue;
    }
    if ("+-*/^()|×÷−".includes(c)) {
      out.push({ kind: "op", value: c === "×" ? "*" : c === "÷" ? "/" : c === "−" ? "-" : c, at: i++ });
      continue;
    }
    return { error: `"${c}" can't be used in a formula.` };
  }
  return out;
}

class ParseError extends Error {}

/** Compile a formula in x, or say what's wrong with it in plain words. */
export function compileExpression(input: string): { fn: Compiled } | { error: string } {
  const src = input.trim().replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, "");
  if (!src) return { error: "Enter a formula, for example 2x + 1." };
  if (src.length > MAX_EXPR_LENGTH) return { error: `Keep the formula under ${MAX_EXPR_LENGTH} characters.` };
  const tokenized = tokenize(src);
  if (!Array.isArray(tokenized)) return tokenized;
  const tokens: Token[] = tokenized;

  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.kind === "op" && peek()!.value === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new ParseError(v === ")" ? "A bracket isn't closed." : `Expected "${v}".`);
    pos++;
  };
  const startsAtom = () => {
    const t = peek();
    return !!t && (t.kind === "num" || t.kind === "id" || (t.kind === "op" && (t.value === "(" || t.value === "|")));
  };

  function expr(): Compiled {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].value;
      const a = left;
      const b = term();
      left = op === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    return left;
  }

  function term(): Compiled {
    let left = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = tokens[pos++].value;
        const a = left;
        const b = unary();
        left = op === "*" ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
      } else if (startsAtom() && !isOp("|")) {
        // Implicit multiplication: "2x", "3(x+1)". A "|" here closes an absolute value.
        const a = left;
        const b = power();
        left = (x) => a(x) * b(x);
      } else return left;
    }
  }

  function unary(): Compiled {
    if (isOp("-")) {
      pos++;
      const a = unary();
      return (x) => -a(x);
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }

  function power(): Compiled {
    const base = atom();
    if (isOp("^")) {
      pos++;
      const exp = unary();
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }

  function atom(): Compiled {
    const t = peek();
    if (!t) throw new ParseError("The formula ends too early.");
    if (t.kind === "num") {
      pos++;
      const v = t.value;
      return () => v;
    }
    if (t.kind === "id") {
      pos++;
      if (t.value === "x") return (x) => x;
      if (t.value in CONSTANTS) {
        const v = CONSTANTS[t.value];
        return () => v;
      }
      const f = FUNCTIONS[t.value];
      if (!isOp("(")) throw new ParseError(`Put brackets after ${t.value}, for example ${t.value}(x).`);
      pos++;
      const arg = expr();
      expect(")");
      return (x) => f(arg(x));
    }
    if (t.value === "(") {
      pos++;
      const inner = expr();
      expect(")");
      return inner;
    }
    if (t.value === "|") {
      pos++;
      const inner = expr();
      if (!isOp("|")) throw new ParseError("An absolute value |…| isn't closed.");
      pos++;
      return (x) => Math.abs(inner(x));
    }
    throw new ParseError(`"${t.value}" is in the wrong place.`);
  }

  try {
    const fn = expr();
    if (pos < tokens.length) throw new ParseError(`"${tokens[pos].value}" is in the wrong place.`);
    return { fn };
  } catch (e) {
    if (e instanceof ParseError) return { error: e.message };
    throw e;
  }
}
