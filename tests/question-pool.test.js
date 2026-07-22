import assert from "node:assert/strict";
import test from "node:test";
import { enumerateQuestionSpecs } from "../src/question-engine.js";
import { QuestionPool, getQuestionPoolSize } from "../src/question-pool.js";

function seededRandom(seed = 987654321) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

const expectedSizes = {
  addition: {
    within10: 66,
    within20: 231,
    twoDigitNoRegroup: 1980,
    twoDigitRegroup: 1260
  },
  subtraction: {
    within10: 66,
    within20: 231,
    twoDigitNoRegroup: 2385,
    twoDigitRegroup: 1620
  },
  mixed: {
    within10: 132,
    within20: 462,
    twoDigitNoRegroup: 4365,
    twoDigitRegroup: 2880
  }
};

test("every operation and level exposes the complete expected pool", () => {
  for (const [operation, levels] of Object.entries(expectedSizes)) {
    for (const [level, expectedSize] of Object.entries(levels)) {
      const specs = enumerateQuestionSpecs({ operation, level });
      assert.equal(specs.length, expectedSize, `${operation}/${level}`);
      assert.equal(new Set(specs.map((spec) => spec.key)).size, expectedSize);
      assert.equal(getQuestionPoolSize({ operation, level }), expectedSize);
    }
  }
});

test("a pool never repeats a question before every item has been used", () => {
  const pool = new QuestionPool({
    operation: "mixed",
    level: "within10",
    rng: seededRandom(42)
  });
  const questions = Array.from({ length: pool.size }, () => pool.next());

  assert.equal(new Set(questions.map((question) => question.poolKey)).size, pool.size);
  assert.deepEqual(
    [...new Set(questions.map((question) => question.operation))].sort(),
    ["addition", "subtraction"]
  );
  assert.equal(pool.remaining, 0);
});

test("refilling the pool does not repeat across the cycle boundary", () => {
  const pool = new QuestionPool({
    operation: "addition",
    level: "within10",
    rng: seededRandom(7)
  });
  const firstCycle = Array.from({ length: pool.size }, () => pool.next());
  const lastQuestion = firstCycle.at(-1);
  const firstQuestionNextCycle = pool.next();

  assert.notEqual(firstQuestionNextCycle.poolKey, lastQuestion.poolKey);
  assert.equal(pool.cycle, 2);
  assert.equal(pool.remaining, pool.size - 1);
});

test("questions drawn from a pool still have four unique answer choices", () => {
  const pool = new QuestionPool({
    operation: "subtraction",
    level: "twoDigitRegroup",
    rng: seededRandom(100)
  });

  for (let index = 0; index < 500; index += 1) {
    const question = pool.next();
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.choices.includes(question.answer));
    assert.ok(question.left % 10 < question.right % 10);
  }
});
