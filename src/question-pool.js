import { createQuestionFromSpec, enumerateQuestionSpecs, shuffle } from "./question-engine.js?v=7";

const poolSizeCache = new Map();

export class QuestionPool {
  constructor({ operation = "addition", level = "within10", rng = Math.random } = {}) {
    this.operation = operation;
    this.level = level;
    this.rng = rng;
    this.specs = enumerateQuestionSpecs({ operation, level });
    this.queue = [];
    this.position = 0;
    this.lastKey = null;
    this.cycle = 0;
    this.refill();
  }

  get size() {
    return this.specs.length;
  }

  get remaining() {
    return this.queue.length - this.position;
  }

  refill() {
    this.queue = shuffle(this.specs, this.rng);
    this.position = 0;
    this.cycle += 1;

    if (this.queue.length > 1 && this.queue[0].key === this.lastKey) {
      [this.queue[0], this.queue[1]] = [this.queue[1], this.queue[0]];
    }
  }

  next() {
    if (this.position >= this.queue.length) this.refill();
    const spec = this.queue[this.position];
    this.position += 1;
    this.lastKey = spec.key;
    return createQuestionFromSpec(spec, this.rng);
  }
}

export function createQuestionPool(options) {
  return new QuestionPool(options);
}

export function getQuestionPoolSize({ operation = "addition", level = "within10" } = {}) {
  const key = `${operation}:${level}`;
  if (!poolSizeCache.has(key)) {
    poolSizeCache.set(key, enumerateQuestionSpecs({ operation, level }).length);
  }
  return poolSizeCache.get(key);
}
