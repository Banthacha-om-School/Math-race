import { LEVELS, OPERATIONS, describeSkill } from "./question-engine.js?v=6";
import { createQuestionPool, getQuestionPoolSize } from "./question-pool.js?v=6";
import { createChoiceOrders, getWinners, rankPlayers } from "./race-rules.js?v=6";

const PLAYER_STYLES = [
  { avatar: "🦊", color: "#ff916d", defaultName: "จิ้งจอก" },
  { avatar: "🐼", color: "#63b7ff", defaultName: "แพนด้า" },
  { avatar: "🐸", color: "#65c98c", defaultName: "กบ" },
  { avatar: "🐯", color: "#f3b749", defaultName: "เสือ" }
];

const defaultSetup = {
  playerCount: 2,
  names: PLAYER_STYLES.map((player) => player.defaultName),
  operation: "addition",
  level: "within10",
  duration: 30
};

const storedSetup = loadJson("math-race-setup", {});
const state = {
  screen: "setup",
  setup: {
    ...defaultSetup,
    ...storedSetup,
    names: Array.isArray(storedSetup.names) ? storedSetup.names : defaultSetup.names
  },
  soundOn: readStorage("math-race-sound") !== "off",
  players: [],
  countdownValue: 3,
  questionPool: null,
  currentQuestion: null,
  choiceOrders: [],
  lockedPlayers: new Set(),
  resolved: false,
  winnerPlayerIndex: null,
  questionNumber: 0,
  questionStartedAt: 0,
  endTime: 0,
  timeLeftMs: 0,
  clockTimer: null,
  transitionTimer: null,
  countdownTimer: null
};

const app = document.querySelector("#app");
const soundButton = document.querySelector("#sound-button");
const homeButton = document.querySelector("#home-button");
let audioContext;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The game still works when private browsing blocks storage.
  }
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(readStorage(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearGameTimers() {
  window.clearInterval(state.clockTimer);
  window.clearInterval(state.countdownTimer);
  window.clearTimeout(state.transitionTimer);
  state.clockTimer = null;
  state.countdownTimer = null;
  state.transitionTimer = null;
}

function updateSoundButton() {
  soundButton.setAttribute("aria-pressed", String(state.soundOn));
  soundButton.innerHTML = `
    <span aria-hidden="true">${state.soundOn ? "🔊" : "🔇"}</span>
    <span class="sound-label">${state.soundOn ? "เปิดเสียง" : "ปิดเสียง"}</span>
  `;
}

function playTone(kind) {
  if (!state.soundOn) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  const isSuccess = kind === "success";

  oscillator.type = isSuccess ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(isSuccess ? 520 : 230, now);
  oscillator.frequency.exponentialRampToValueAtTime(isSuccess ? 780 : 165, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.23);
}

function render() {
  updateSoundButton();
  if (state.screen === "countdown") renderCountdown();
  else if (state.screen === "game") renderGame();
  else if (state.screen === "results") renderResults();
  else renderSetup();
}

function renderSetup() {
  document.title = "Math Race Junior — ตั้งค่าเกม";
  const { playerCount, operation, level, duration } = state.setup;
  const modeText = playerCount === 1 ? "ฝึกคนเดียว" : `แข่งพร้อมกัน ${playerCount} คน`;
  const poolSize = getQuestionPoolSize({ operation, level });
  const formattedPoolSize = poolSize.toLocaleString("th-TH");

  app.innerHTML = `
    <div class="page setup-page">
      <section class="setup-hero">
        <div class="hero-copy">
          <p class="eyebrow"><span aria-hidden="true">⚡</span> เห็นพร้อมกัน คิดให้ไว กดให้ถูก</p>
          <h1>แข่งคณิต<br />พร้อมกันทุกคน</h1>
          <p>โจทย์เดียวกัน แต่แต่ละคนมีแผงคำตอบของตัวเอง คนแรกที่ตอบถูกได้คะแนน แล้วโจทย์ใหม่จะมาต่อทันที</p>
        </div>
        <div class="hero-preview" aria-hidden="true">
          <div class="preview-race">
            <div class="preview-bubble">6 + 3 = ?</div>
            <div class="preview-answer-row"><span>🦊 9</span><span>🐼 8</span></div>
            <div class="preview-answer-row"><span>🐸 7</span><span>🐯 9</span></div>
          </div>
        </div>
      </section>

      <section class="setup-section" aria-labelledby="players-title">
        <div class="section-heading">
          <div>
            <h2 id="players-title">เลือกนักแข่ง</h2>
            <p>แต่ละคนใช้แผงสีของตัวเองบน iPad เครื่องเดียว</p>
          </div>
          <span class="step-number" aria-hidden="true">1</span>
        </div>
        <div class="choice-row" role="group" aria-label="จำนวนผู้เล่น">
          ${[1, 2, 3, 4].map((count) => `
            <button class="choice-button ${playerCount === count ? "is-selected" : ""}" type="button"
              data-player-count="${count}" aria-pressed="${playerCount === count}">
              ${count === 1 ? "คนเดียว" : `${count} คน`}
            </button>
          `).join("")}
        </div>
        <div class="players-grid">
          ${PLAYER_STYLES.slice(0, playerCount).map((player, index) => `
            <label class="player-input-card" style="--player-color: ${player.color}">
              <span class="player-label"><span class="player-avatar" aria-hidden="true">${player.avatar}</span> ผู้เล่น ${index + 1}</span>
              <input class="name-input" data-player-name="${index}" maxlength="16"
                value="${escapeHtml(state.setup.names[index] || player.defaultName)}" aria-label="ชื่อผู้เล่น ${index + 1}" />
            </label>
          `).join("")}
        </div>
      </section>

      <section class="setup-section" aria-labelledby="challenge-title">
        <div class="section-heading">
          <div>
            <h2 id="challenge-title">เลือกโจทย์และเวลา</h2>
            <p>เริ่มที่ 30 วินาทีเพื่อให้รอบสั้นและเล่นซ้ำได้ง่าย</p>
          </div>
          <span class="step-number" aria-hidden="true">2</span>
        </div>
        <div class="settings-grid simultaneous-settings">
          <div class="setting-block">
            <strong>หมวด</strong>
            <div class="choice-row" role="group" aria-label="หมวดโจทย์">
              ${Object.values(OPERATIONS).map((item) => `
                <button class="choice-button ${operation === item.id ? "is-selected" : ""}" type="button"
                  data-operation="${item.id}" aria-pressed="${operation === item.id}">
                  ${item.symbol} ${item.label}
                </button>
              `).join("")}
            </div>
          </div>
          <div class="setting-block">
            <strong>ระดับ</strong>
            <div class="levels-grid" role="group" aria-label="ระดับโจทย์">
              ${Object.values(LEVELS).map((item) => `
                <button class="level-button ${level === item.id ? "is-selected" : ""}" type="button"
                  data-level="${item.id}" aria-pressed="${level === item.id}">
                  <span>${item.label}</span><small>${item.description}</small>
                </button>
              `).join("")}
            </div>
          </div>
          <div class="setting-block">
            <strong>เวลาแข่งขัน</strong>
            <div class="choice-row" role="group" aria-label="เวลาแข่งขัน">
              ${[30, 60].map((seconds) => `
                <button class="choice-button time-choice ${duration === seconds ? "is-selected" : ""}" type="button"
                  data-duration="${seconds}" aria-pressed="${duration === seconds}">${seconds === 60 ? "1 นาที" : "30 วิ"}</button>
              `).join("")}
            </div>
          </div>
        </div>
      </section>

      <section class="rules-strip" aria-label="กติกาเกม">
        <div><span aria-hidden="true">①</span><strong>ตอบถูกคนแรก</strong><small>ได้ 1 คะแนน</small></div>
        <div><span aria-hidden="true">②</span><strong>ตอบผิด</strong><small>พักเฉพาะข้อนั้น</small></div>
        <div><span aria-hidden="true">③</span><strong>คลัง ${formattedPoolSize} แบบ</strong><small>สุ่มไม่ซ้ำจนหมดชุด</small></div>
      </section>

      <div class="start-bar">
        <div class="start-summary">
          <strong>${modeText} • ${describeSkill(operation, level)}</strong>
          <small>${duration === 60 ? "1 นาที" : "30 วินาที"} • สุ่มไม่ซ้ำจากคลัง ${formattedPoolSize} แบบ</small>
        </div>
        <button class="primary-button large" id="start-game" type="button">พร้อมแล้ว เริ่มเลย <span aria-hidden="true">→</span></button>
      </div>
    </div>
  `;

  bindSetupEvents();
}

function captureNames() {
  app.querySelectorAll("[data-player-name]").forEach((input) => {
    const index = Number(input.dataset.playerName);
    state.setup.names[index] = input.value.trim() || PLAYER_STYLES[index].defaultName;
  });
}

function updateSetup(key, value) {
  captureNames();
  state.setup[key] = value;
  renderSetup();
}

function bindSetupEvents() {
  app.querySelectorAll("[data-player-count]").forEach((button) => {
    button.addEventListener("click", () => updateSetup("playerCount", Number(button.dataset.playerCount)));
  });
  app.querySelectorAll("[data-operation]").forEach((button) => {
    button.addEventListener("click", () => updateSetup("operation", button.dataset.operation));
  });
  app.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => updateSetup("level", button.dataset.level));
  });
  app.querySelectorAll("[data-duration]").forEach((button) => {
    button.addEventListener("click", () => updateSetup("duration", Number(button.dataset.duration)));
  });
  document.querySelector("#start-game").addEventListener("click", startGame);
}

function startGame() {
  captureNames();
  clearGameTimers();
  const { playerCount, names } = state.setup;
  state.players = PLAYER_STYLES.slice(0, playerCount).map((style, index) => ({
    ...style,
    name: names[index] || style.defaultName,
    score: 0,
    correct: 0,
    attempts: 0,
    wrong: 0,
    fastestMs: Number.POSITIVE_INFINITY,
    totalResponseMs: 0
  }));
  state.questionPool = createQuestionPool({
    operation: state.setup.operation,
    level: state.setup.level
  });
  state.questionNumber = 0;
  state.timeLeftMs = state.setup.duration * 1000;
  state.countdownValue = 3;
  state.screen = "countdown";
  writeStorage("math-race-setup", JSON.stringify(state.setup));
  renderCountdown();
  state.countdownTimer = window.setInterval(() => {
    state.countdownValue -= 1;
    if (state.countdownValue <= 0) {
      window.clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      beginTimedGame();
    } else {
      renderCountdown();
    }
  }, 1000);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCountdown() {
  document.title = "Math Race Junior — เตรียมตัว";
  app.innerHTML = `
    <div class="page countdown-page">
      <p class="eyebrow">วางมือที่แผงสีของตัวเอง</p>
      <div class="countdown-number" aria-live="assertive">${state.countdownValue}</div>
      <p class="countdown-message">เตรียมคิดพร้อมกัน!</p>
      <div class="countdown-players">
        ${state.players.map((player) => `
          <span style="--player-color: ${player.color}">${player.avatar} ${escapeHtml(player.name)}</span>
        `).join("")}
      </div>
    </div>
  `;
}

function beginTimedGame() {
  state.screen = "game";
  state.endTime = performance.now() + state.setup.duration * 1000;
  prepareQuestion();
  state.clockTimer = window.setInterval(updateClock, 100);
}

function prepareQuestion() {
  if (state.screen !== "game") return;
  if (performance.now() >= state.endTime) {
    finishGame();
    return;
  }
  state.currentQuestion = state.questionPool.next();
  state.choiceOrders = createChoiceOrders(state.currentQuestion.choices, state.players.length);
  state.lockedPlayers = new Set();
  state.resolved = false;
  state.winnerPlayerIndex = null;
  state.questionNumber += 1;
  state.questionStartedAt = performance.now();
  renderGame();
  updateClock();
}

function updateClock() {
  if (state.screen !== "game") return;
  state.timeLeftMs = Math.max(0, state.endTime - performance.now());
  const seconds = Math.ceil(state.timeLeftMs / 1000);
  const progress = (state.timeLeftMs / (state.setup.duration * 1000)) * 100;
  const timerValue = document.querySelector("#timer-seconds");
  const timerBar = document.querySelector(".timer-fill");
  if (timerValue) timerValue.textContent = String(seconds);
  if (timerBar) timerBar.style.width = `${progress}%`;
  if (state.timeLeftMs <= 0) finishGame();
}

function renderScoreStrip() {
  return state.players.map((player, index) => `
    <div class="live-score ${state.winnerPlayerIndex === index ? "just-scored" : ""}" style="--player-color: ${player.color}">
      <span aria-hidden="true">${player.avatar}</span>
      <strong>${escapeHtml(player.name)}</strong>
      <b>⭐ ${player.score}</b>
    </div>
  `).join("");
}

function panelStatus(index) {
  if (state.winnerPlayerIndex === index) return "เร็วที่สุด! +1";
  if (state.resolved && state.winnerPlayerIndex !== null) return "รอข้อถัดไป";
  if (state.resolved) return "เฉลยแล้ว รอข้อถัดไป";
  if (state.lockedPlayers.has(index)) return "ตอบผิด พักข้อนี้";
  return "เลือกคำตอบของเรา";
}

function renderAnswerPanel(player, playerIndex) {
  const isLocked = state.lockedPlayers.has(playerIndex);
  const choices = state.choiceOrders[playerIndex];
  return `
    <section class="answer-panel ${isLocked ? "is-locked" : ""} ${state.winnerPlayerIndex === playerIndex ? "is-winner" : ""}"
      style="--player-color: ${player.color}" aria-labelledby="player-${playerIndex}-name">
      <header class="panel-header">
        <div class="panel-player">
          <span aria-hidden="true">${player.avatar}</span>
          <strong id="player-${playerIndex}-name">${escapeHtml(player.name)}</strong>
        </div>
        <span class="panel-status">${panelStatus(playerIndex)}</span>
      </header>
      <div class="panel-answers">
        ${choices.map((choice) => {
          const revealCorrect = state.resolved && choice === state.currentQuestion.answer;
          return `
            <button class="panel-answer ${revealCorrect ? "is-correct" : ""}" type="button"
              data-player="${playerIndex}" data-answer="${choice}"
              ${state.resolved || isLocked ? "disabled" : ""}
              aria-label="${escapeHtml(player.name)} ตอบ ${choice}">${choice}</button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderGame() {
  document.title = "Math Race Junior — แข่งพร้อมกัน";
  const seconds = Math.ceil(state.timeLeftMs / 1000);
  const progress = (state.timeLeftMs / (state.setup.duration * 1000)) * 100;

  app.innerHTML = `
    <div class="page simultaneous-game">
      <section class="arena-top" aria-labelledby="shared-question">
        <div class="timer-box" aria-label="เวลาที่เหลือ">
          <span id="timer-seconds">${seconds}</span><small>วินาที</small>
          <div class="timer-track" aria-hidden="true"><div class="timer-fill" style="width: ${progress}%"></div></div>
        </div>
        <div class="shared-question">
          <span>ข้อ ${state.questionNumber} • ${describeSkill(state.setup.operation, state.setup.level)} • คลัง ${state.questionPool.size.toLocaleString("th-TH")} แบบ</span>
          <h1 id="shared-question">${state.currentQuestion.prompt} = ?</h1>
        </div>
        <div class="speed-rule"><span aria-hidden="true">⚡</span><strong>ถูกคนแรก</strong><small>ได้ 1 คะแนน</small></div>
      </section>

      <div class="live-scores">${renderScoreStrip()}</div>

      <div class="answer-panels player-count-${state.players.length}">
        ${state.players.map((player, index) => renderAnswerPanel(player, index)).join("")}
      </div>
    </div>
  `;

  app.querySelectorAll("[data-player][data-answer]").forEach((button) => {
    button.addEventListener("click", () => answerQuestion(
      Number(button.dataset.player),
      Number(button.dataset.answer)
    ));
  });
}

function answerQuestion(playerIndex, answer) {
  if (state.screen !== "game" || state.resolved || state.lockedPlayers.has(playerIndex)) return;
  if (performance.now() >= state.endTime) {
    finishGame();
    return;
  }
  const player = state.players[playerIndex];
  const responseMs = performance.now() - state.questionStartedAt;
  player.attempts += 1;

  if (answer === state.currentQuestion.answer) {
    state.resolved = true;
    state.winnerPlayerIndex = playerIndex;
    player.score += 1;
    player.correct += 1;
    player.totalResponseMs += responseMs;
    player.fastestMs = Math.min(player.fastestMs, responseMs);
    playTone("success");
    renderGame();
    state.transitionTimer = window.setTimeout(prepareQuestion, 650);
    return;
  }

  player.wrong += 1;
  state.lockedPlayers.add(playerIndex);
  playTone("wrong");
  if (state.lockedPlayers.size === state.players.length) {
    state.resolved = true;
    renderGame();
    state.transitionTimer = window.setTimeout(prepareQuestion, 900);
  } else {
    renderGame();
  }
}

function finishGame() {
  if (state.screen !== "game") return;
  clearGameTimers();
  state.timeLeftMs = 0;
  state.screen = "results";
  renderResults();
  playTone("success");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderResults() {
  document.title = "Math Race Junior — สรุปผล";
  const ranking = rankPlayers(state.players);
  const winners = getWinners(state.players);
  const winnerText = winners.length === 1
    ? `${winners[0].avatar} ${escapeHtml(winners[0].name)} ได้คะแนนมากที่สุด!`
    : `เสมอกัน ${winners.map((player) => `${player.avatar} ${escapeHtml(player.name)}`).join(" และ ")}!`;

  app.innerHTML = `
    <div class="page results-wrap">
      <section class="result-card">
        <div class="trophy" aria-hidden="true">🏆</div>
        <p class="eyebrow">หมดเวลา • เล่นไป ${state.questionNumber} ข้อจากคลัง ${state.questionPool.size.toLocaleString("th-TH")} แบบ</p>
        <h1>จบการแข่งขัน!</h1>
        <p class="winner-line">${winnerText}</p>

        <div class="scoreboard" aria-label="ตารางผลการแข่งขัน">
          ${ranking.map((player, index) => {
            const accuracy = player.attempts ? Math.round((player.correct / player.attempts) * 100) : 0;
            const fastest = Number.isFinite(player.fastestMs) ? `${(player.fastestMs / 1000).toFixed(1)} วิ` : "—";
            return `
              <div class="score-row" style="--player-color: ${player.color}">
                <div class="score-rank">${index + 1}</div>
                <div class="score-player">
                  <strong>${player.avatar} ${escapeHtml(player.name)}</strong>
                  <span>ถูก ${player.correct}/${player.attempts} ครั้ง (${accuracy}%) • เร็วสุด ${fastest}</span>
                </div>
                <div class="score-stars">⭐ ${player.score}</div>
              </div>
            `;
          }).join("")}
        </div>

        <div class="result-actions">
          <button class="primary-button large" id="play-again" type="button">แข่งอีกครั้ง</button>
          <button class="secondary-button" id="change-settings" type="button">เปลี่ยนการตั้งค่า</button>
        </div>
        <p class="teacher-note">โหมดนี้วัดทั้งความแม่นและความคล่อง ควรจับคู่เด็กที่ใช้ระดับโจทย์ใกล้เคียงกัน</p>
      </section>
    </div>
  `;

  document.querySelector("#play-again").addEventListener("click", startGame);
  document.querySelector("#change-settings").addEventListener("click", goHome);
}

function goHome() {
  clearGameTimers();
  state.screen = "setup";
  state.players = [];
  state.questionPool = null;
  renderSetup();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  writeStorage("math-race-sound", state.soundOn ? "on" : "off");
  updateSoundButton();
  if (state.soundOn) playTone("success");
});

homeButton.addEventListener("click", () => {
  const isActiveGame = state.screen === "countdown" || state.screen === "game";
  if (isActiveGame && !window.confirm("ออกจากการแข่งขันรอบนี้และกลับหน้าแรกหรือไม่?")) return;
  goHome();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.screen === "game") updateClock();
});

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

render();
