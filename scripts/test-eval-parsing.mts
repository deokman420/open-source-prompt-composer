/**
 * Eval JSON-repair tests.
 *
 * Models ignore "return strict JSON" often enough that safeParseJson is what
 * stands between a working eval and a wasted paid API call. Each case here is a
 * failure shape actually observed from a provider.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  safeParseJson,
  EVAL_MODES,
  EVAL_MODE_SCHEMAS,
  EVAL_MODE_LABELS,
  MODES,
} from "../src/lib/eval/modes.ts";

test("parses clean JSON", () => {
  const { parsed, parseError } = safeParseJson('{"overall": 72}');
  assert.equal(parseError, null);
  assert.deepEqual(parsed, { overall: 72 });
});

test("strips ```json fences", () => {
  const { parsed, parseError } = safeParseJson('```json\n{"overall": 72}\n```');
  assert.equal(parseError, null);
  assert.deepEqual(parsed, { overall: 72 });
});

test("strips bare ``` fences", () => {
  const { parsed, parseError } = safeParseJson('```\n{"a": 1}\n```');
  assert.equal(parseError, null);
  assert.deepEqual(parsed, { a: 1 });
});

test("extracts JSON despite a chatty preamble", () => {
  const { parsed, parseError } = safeParseJson(
    'Sure! Here is the evaluation you asked for:\n\n{"overall": 55, "feedback": "ok"}'
  );
  assert.equal(parseError, null);
  assert.deepEqual(parsed, { overall: 55, feedback: "ok" });
});

test("extracts JSON despite trailing prose", () => {
  const { parsed, parseError } = safeParseJson(
    '{"overall": 61}\n\nLet me know if you would like me to elaborate!'
  );
  assert.equal(parseError, null);
  assert.deepEqual(parsed, { overall: 61 });
});

test("ignores braces inside string values", () => {
  // The balanced-brace scanner must not be fooled by a { inside a string, or it
  // truncates the object early and reports a parse error on valid output.
  const raw = 'Here you go: {"feedback": "use {curly} braces in your prompt", "overall": 40} done';
  const { parsed, parseError } = safeParseJson(raw);
  assert.equal(parseError, null);
  assert.deepEqual(parsed, {
    feedback: "use {curly} braces in your prompt",
    overall: 40,
  });
});

test("handles escaped quotes inside strings", () => {
  const raw = '{"feedback": "he said \\"hello\\" loudly"}';
  const { parsed, parseError } = safeParseJson(raw);
  assert.equal(parseError, null);
  assert.deepEqual(parsed, { feedback: 'he said "hello" loudly' });
});

test("parses a top-level array", () => {
  const { parsed, parseError } = safeParseJson('prefix [{"a":1},{"b":2}] suffix');
  assert.equal(parseError, null);
  assert.deepEqual(parsed, [{ a: 1 }, { b: 2 }]);
});

test("reports an error rather than throwing on unparseable output", () => {
  const { parsed, parseError } = safeParseJson("I'm sorry, I can't help with that.");
  assert.equal(parsed, null);
  assert.ok(parseError, "a parse failure must be reported so the UI can show raw output");
});

test("reports an error on a truncated object", () => {
  // Hitting max_tokens mid-object is the most common real failure.
  const { parsed, parseError } = safeParseJson('{"overall": 61, "feedback": "the prompt is');
  assert.equal(parsed, null);
  assert.ok(parseError);
});

test("every mode has a label, a schema, and a prompt spec", () => {
  for (const mode of EVAL_MODES) {
    assert.ok(EVAL_MODE_LABELS[mode], `${mode} has no label`);
    assert.ok(EVAL_MODE_SCHEMAS[mode], `${mode} has no schema`);
    assert.ok(MODES[mode].system.length > 0, `${mode} has no system prompt`);
    assert.ok(MODES[mode].maxTokens > 0, `${mode} has no token budget`);
    assert.match(
      MODES[mode].user("PROMPT"),
      /PROMPT/,
      `${mode} does not interpolate the prompt`
    );
  }
});

test("schemas conform to the structured-output subset", () => {
  // Anthropic's structured outputs reject schemas with missing `required`,
  // absent `additionalProperties: false`, or numeric bounds. Sending one that
  // violates this is a 400 on every request in that mode — worth catching here
  // rather than in production.
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    if (o.type === "object") {
      assert.ok(Array.isArray(o.required), `${path}: object missing 'required'`);
      assert.equal(
        o.additionalProperties,
        false,
        `${path}: object missing 'additionalProperties: false'`
      );
      const props = (o.properties ?? {}) as Record<string, unknown>;
      assert.deepEqual(
        [...(o.required as string[])].sort(),
        Object.keys(props).sort(),
        `${path}: 'required' must list every property`
      );
      for (const [k, v] of Object.entries(props)) walk(v, `${path}.${k}`);
    }

    if (o.type === "array") walk(o.items, `${path}[]`);

    for (const banned of ["minimum", "maximum", "minLength", "maxLength", "pattern"]) {
      assert.equal(o[banned], undefined, `${path}: '${banned}' is outside the subset`);
    }

    if (Array.isArray(o.anyOf)) o.anyOf.forEach((n, i) => walk(n, `${path}|${i}`));
  };

  for (const mode of EVAL_MODES) walk(EVAL_MODE_SCHEMAS[mode], mode);
});
