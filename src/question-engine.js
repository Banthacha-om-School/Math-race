export const OPERATIONS = Object.freeze({
  addition: { id: "addition", label: "การบวก", symbol: "+" },
  subtraction: { id: "subtraction", label: "การลบ", symbol: "−" },
  mixed: { id: "mixed", label: "บวกและลบ", symbol: "±" }
});

export const LEVELS = Object.freeze({
  within10: {
    id: "within10",
    label: "ไม่เกิน 10",
    description: "พื้นฐาน ป.1",
    maxAnswer: 10,
    hintType: "counters"
  },
  within20: {
    id: "within20",
    label: "ไม่เกิน 20",
    description: "ข้ามหลักสิบ",
    maxAnswer: 20,
    hintType: "counters"
  },
  twoDigitNoRegroup: {
    id: "twoDigitNoRegroup",
    label: "สองหลัก ไม่ทด/ไม่ยืม",
    description: "แยกหลักสิบ–หน่วย",
    maxAnswer: 99,
    hintType: "placeValue"
  },
  twoDigitRegroup: {
    id: "twoDigitRegroup",
    label: "สองหลัก มีทด/มีการยืม",
    description: "ระดับ ป.2",
    maxAnswer: 99,
    hintType: "placeValue"
  }
});

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOperation(operation, rng) {
  if (operation === "mixed") {
    return rng() < 0.5 ? "addition" : "subtraction";
  }
  return operation;
}

function buildWithin(max, operation, rng) {
  if (operation === "addition") {
    const left = randomInt(rng, 0, max);
    const right = randomInt(rng, 0, max - left);
    return { left, right };
  }

  const left = randomInt(rng, 0, max);
  const right = randomInt(rng, 0, left);
  return { left, right };
}

function buildTwoDigitNoRegroup(operation, rng) {
  if (operation === "addition") {
    const leftTens = randomInt(rng, 1, 8);
    const rightTens = randomInt(rng, 1, 9 - leftTens);
    const leftOnes = randomInt(rng, 0, 9);
    const rightOnes = randomInt(rng, 0, 9 - leftOnes);
    return {
      left: leftTens * 10 + leftOnes,
      right: rightTens * 10 + rightOnes
    };
  }

  const leftTens = randomInt(rng, 2, 9);
  const rightTens = randomInt(rng, 1, leftTens - 1);
  const leftOnes = randomInt(rng, 0, 9);
  const rightOnes = randomInt(rng, 0, leftOnes);
  return {
    left: leftTens * 10 + leftOnes,
    right: rightTens * 10 + rightOnes
  };
}

function buildTwoDigitRegroup(operation, rng) {
  if (operation === "addition") {
    const leftTens = randomInt(rng, 1, 7);
    const rightTens = randomInt(rng, 1, 8 - leftTens);
    const leftOnes = randomInt(rng, 1, 9);
    const rightOnes = randomInt(rng, 10 - leftOnes, 9);
    return {
      left: leftTens * 10 + leftOnes,
      right: rightTens * 10 + rightOnes
    };
  }

  const leftTens = randomInt(rng, 2, 9);
  const rightTens = randomInt(rng, 1, leftTens - 1);
  const leftOnes = randomInt(rng, 0, 8);
  const rightOnes = randomInt(rng, leftOnes + 1, 9);
  return {
    left: leftTens * 10 + leftOnes,
    right: rightTens * 10 + rightOnes
  };
}

function createDistractors({ left, right, answer, operation, maxAnswer }, rng) {
  const candidates = [
    answer + 1,
    answer - 1,
    answer + 2,
    answer - 2,
    answer + 10,
    answer - 10,
    operation === "addition" ? Math.abs(left - right) : left + right,
    operation === "addition" ? answer - 10 : answer + 10
  ];

  const choices = new Set([answer]);
  for (const candidate of candidates) {
    if (Number.isInteger(candidate) && candidate >= 0 && candidate <= maxAnswer) {
      choices.add(candidate);
    }
    if (choices.size === 4) break;
  }

  for (let offset = 3; choices.size < 4; offset += 1) {
    const above = answer + offset;
    const below = answer - offset;
    if (above <= maxAnswer) choices.add(above);
    if (choices.size < 4 && below >= 0) choices.add(below);
  }

  return shuffle([...choices], rng);
}

export function shuffle(values, rng = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function generateQuestion({ operation = "addition", level = "within10", rng = Math.random } = {}) {
  if (!OPERATIONS[operation]) {
    throw new Error(`Unknown operation: ${operation}`);
  }
  if (!LEVELS[level]) {
    throw new Error(`Unknown level: ${level}`);
  }

  const actualOperation = pickOperation(operation, rng);
  let operands;

  switch (level) {
    case "within10":
      operands = buildWithin(10, actualOperation, rng);
      break;
    case "within20":
      operands = buildWithin(20, actualOperation, rng);
      break;
    case "twoDigitNoRegroup":
      operands = buildTwoDigitNoRegroup(actualOperation, rng);
      break;
    case "twoDigitRegroup":
      operands = buildTwoDigitRegroup(actualOperation, rng);
      break;
    default:
      throw new Error(`Unsupported level: ${level}`);
  }

  const answer = actualOperation === "addition"
    ? operands.left + operands.right
    : operands.left - operands.right;
  const symbol = OPERATIONS[actualOperation].symbol;
  const levelConfig = LEVELS[level];

  return {
    id: `${Date.now()}-${Math.floor(rng() * 1_000_000)}`,
    operation: actualOperation,
    level,
    left: operands.left,
    right: operands.right,
    symbol,
    answer,
    prompt: `${operands.left} ${symbol} ${operands.right}`,
    choices: createDistractors({
      ...operands,
      answer,
      operation: actualOperation,
      maxAnswer: levelConfig.maxAnswer
    }, rng),
    hintType: levelConfig.hintType
  };
}

export function describeSkill(operation, level) {
  const operationLabel = OPERATIONS[operation]?.label ?? "คณิตศาสตร์";
  const levelLabel = LEVELS[level]?.label ?? "";
  return `${operationLabel} ${levelLabel}`.trim();
}
