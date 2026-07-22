import assert from "node:assert/strict";
import test from "node:test";
import { LEVELS, generateQuestion } from "../src/question-engine.js";

function seededRandom(seed = 123456789) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function sample(operation, level, count = 2_000) {
  const rng = seededRandom(42);
  return Array.from({ length: count }, () => generateQuestion({ operation, level, rng }));
}

for (const operation of ["addition", "subtraction", "mixed"]) {
  for (const level of Object.keys(LEVELS)) {
    test(`${operation} / ${level} always creates one valid answer and four unique choices`, () => {
      for (const question of sample(operation, level, 400)) {
        assert.equal(question.choices.length, 4);
        assert.equal(new Set(question.choices).size, 4);
        assert.ok(question.choices.includes(question.answer));
        assert.ok(question.answer >= 0);
        assert.ok(question.answer <= LEVELS[level].maxAnswer);
        assert.equal(
          question.answer,
          question.operation === "addition"
            ? question.left + question.right
            : question.left - question.right
        );
      }
    });
  }
}

test("within-10 and within-20 questions stay inside their selected range", () => {
  for (const max of [10, 20]) {
    const level = max === 10 ? "within10" : "within20";
    for (const operation of ["addition", "subtraction"]) {
      for (const question of sample(operation, level)) {
        assert.ok(question.left >= 0 && question.left <= max);
        assert.ok(question.right >= 0 && question.right <= max);
        assert.ok(question.answer >= 0 && question.answer <= max);
      }
    }
  }
});

test("two-digit no-regroup addition never carries and subtraction never borrows", () => {
  for (const question of sample("addition", "twoDigitNoRegroup")) {
    assert.ok(question.left >= 10 && question.right >= 10);
    assert.ok((question.left % 10) + (question.right % 10) < 10);
    assert.ok(question.answer <= 99);
  }

  for (const question of sample("subtraction", "twoDigitNoRegroup")) {
    assert.ok(question.left >= 10 && question.right >= 10);
    assert.ok(question.left > question.right);
    assert.ok(question.left % 10 >= question.right % 10);
  }
});

test("two-digit regroup questions always carry or borrow as advertised", () => {
  for (const question of sample("addition", "twoDigitRegroup")) {
    assert.ok(question.left >= 10 && question.right >= 10);
    assert.ok((question.left % 10) + (question.right % 10) >= 10);
    assert.ok(question.answer <= 99);
  }

  for (const question of sample("subtraction", "twoDigitRegroup")) {
    assert.ok(question.left >= 10 && question.right >= 10);
    assert.ok(question.left > question.right);
    assert.ok(question.left % 10 < question.right % 10);
  }
});

test("mixed mode produces both addition and subtraction", () => {
  const operations = new Set(sample("mixed", "within20", 200).map((question) => question.operation));
  assert.deepEqual([...operations].sort(), ["addition", "subtraction"]);
});

test("invalid configuration is rejected", () => {
  assert.throws(() => generateQuestion({ operation: "multiply" }), /Unknown operation/);
  assert.throws(() => generateQuestion({ level: "expert" }), /Unknown level/);
});
