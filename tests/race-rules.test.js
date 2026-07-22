import assert from "node:assert/strict";
import test from "node:test";
import { createChoiceOrders, getWinners, rankPlayers } from "../src/race-rules.js";

test("each player gets the same choices in a different rotation", () => {
  const choices = [7, 8, 9, 10];
  const orders = createChoiceOrders(choices, 4, () => 0.25);

  assert.equal(orders.length, 4);
  for (const order of orders) {
    assert.deepEqual([...order].sort((a, b) => a - b), choices);
  }
  assert.equal(new Set(orders.map((order) => order.indexOf(9))).size, 4);
});

test("choice layout rejects unsafe input", () => {
  assert.throws(() => createChoiceOrders([1, 2, 3], 2), /four unique choices/);
  assert.throws(() => createChoiceOrders([1, 1, 2, 3], 2), /four unique choices/);
  assert.throws(() => createChoiceOrders([1, 2, 3, 4], 5), /between 1 and 4/);
});

test("ranking uses score first and fewer wrong answers as the display tiebreaker", () => {
  const players = [
    { name: "A", score: 3, wrong: 2 },
    { name: "B", score: 4, wrong: 3 },
    { name: "C", score: 4, wrong: 1 }
  ];
  assert.deepEqual(rankPlayers(players).map((player) => player.name), ["C", "B", "A"]);
});

test("winners remain tied when their scores match", () => {
  const players = [
    { name: "A", score: 5, wrong: 4 },
    { name: "B", score: 5, wrong: 1 },
    { name: "C", score: 3, wrong: 0 }
  ];
  assert.deepEqual(getWinners(players).map((player) => player.name).sort(), ["A", "B"]);
});
