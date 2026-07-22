import { shuffle } from "./question-engine.js?v=8";

export function createChoiceOrders(choices, playerCount, rng = Math.random) {
  if (!Array.isArray(choices) || choices.length !== 4 || new Set(choices).size !== 4) {
    throw new Error("Exactly four unique choices are required");
  }
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 4) {
    throw new Error("Player count must be between 1 and 4");
  }

  const base = shuffle(choices, rng);
  return Array.from({ length: playerCount }, (_, index) => [
    ...base.slice(index),
    ...base.slice(0, index)
  ]);
}

export function rankPlayers(players) {
  return [...players].sort((left, right) =>
    right.score - left.score || left.wrong - right.wrong
  );
}

export function getWinners(players) {
  const ranking = rankPlayers(players);
  if (ranking.length === 0) return [];
  return ranking.filter((player) => player.score === ranking[0].score);
}
