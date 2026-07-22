import { LEVELS, OPERATIONS, describeSkill, generateQuestion } from "./question-engine.js";

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
  rounds: 5
};

const storedSetup = loadJson("math-race-setup", {});
const state = {
  screen: "setup",
  setup: {
    ...defaultSetup,
    ...storedSetup,
    names: Array.isArray(storedSetup.names) ? storedSetup.names : defaultSetup.names
  },
  soundOn: localStorage.getItem("math-race-sound") !== "off",
  players: [],
  turnIndex: 0,
  currentQuestion: null,
  previousPrompt: "",
  hintUsed: false,
  answered: false,
  selectedAnswer: null,
  wasCorrect: false
};

const app = document.querySelector("#app");
const soundButton = document.querySelector("#sound-button");
const homeButton = document.querySelector("#home-button");
let audioContext;

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
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
  if (state.screen === "game") renderGame();
  else if (state.screen === "results") renderResults();
  else renderSetup();
}

function renderSetup() {
  document.title = "Math Race Junior — ตั้งค่าเกม";
  const { playerCount, operation, level, rounds } = state.setup;
  const modeText = playerCount === 1 ? "ฝึกคนเดียว" : `แข่ง ${playerCount} คน`;
  const totalQuestions = playerCount * rounds;

  app.innerHTML = `
    <div class="page setup-page">
      <section class="setup-hero">
        <div class="hero-copy">
          <p class="eyebrow"><span aria-hidden="true">🏁</span> ผลัดกันคิด พิชิตเส้นชัย</p>
          <h1>แข่งคณิต<br />ให้สนุกทุกตา</h1>
          <p>เกมรอบสั้นสำหรับเด็ก ป.1–ป.2 ทุกคนได้ตอบเท่ากัน คิดได้เต็มที่ และเรียนรู้จากคำใบ้เมื่อยังไม่แน่ใจ</p>
        </div>
        <div class="hero-preview" aria-hidden="true">
          <div class="preview-race">
            <div class="preview-bubble">6 + 3 = ?</div>
            <div class="preview-lane"><span class="preview-runner" style="--position: 38%">🦊</span></div>
            <div class="preview-lane"><span class="preview-runner" style="--position: 67%">🐼</span></div>
          </div>
        </div>
      </section>

      <section class="setup-section" aria-labelledby="players-title">
        <div class="section-heading">
          <div>
            <h2 id="players-title">เลือกนักแข่ง</h2>
            <p>ใช้ iPad เครื่องเดียวและผลัดกันตอบทีละคน</p>
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
            <h2 id="challenge-title">เลือกโจทย์</h2>
            <p>เริ่มจากระดับที่เด็กมั่นใจ แล้วค่อยขยับขึ้น</p>
          </div>
          <span class="step-number" aria-hidden="true">2</span>
        </div>
        <div class="settings-grid">
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
            <strong>จำนวนตาต่อคน</strong>
            <div class="choice-row" role="group" aria-label="จำนวนตาต่อคน">
              ${[3, 5, 7].map((count) => `
                <button class="choice-button ${rounds === count ? "is-selected" : ""}" type="button"
                  data-rounds="${count}" aria-pressed="${rounds === count}">${count}</button>
              `).join("")}
            </div>
          </div>
        </div>
      </section>

      <div class="start-bar">
        <div class="start-summary">
          <strong>${modeText} • ${describeSkill(operation, level)}</strong>
          <small>ทั้งหมด ${totalQuestions} ข้อ • ทุกคนได้ ${rounds} ตาเท่ากัน</small>
        </div>
        <button class="primary-button large" id="start-game" type="button">เริ่มการแข่งขัน <span aria-hidden="true">→</span></button>
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

function bindSetupEvents() {
  app.querySelectorAll("[data-player-count]").forEach((button) => {
    button.addEventListener("click", () => {
      captureNames();
      state.setup.playerCount = Number(button.dataset.playerCount);
      renderSetup();
    });
  });

  app.querySelectorAll("[data-operation]").forEach((button) => {
    button.addEventListener("click", () => {
      captureNames();
      state.setup.operation = button.dataset.operation;
      renderSetup();
    });
  });

  app.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      captureNames();
      state.setup.level = button.dataset.level;
      renderSetup();
    });
  });

  app.querySelectorAll("[data-rounds]").forEach((button) => {
    button.addEventListener("click", () => {
      captureNames();
      state.setup.rounds = Number(button.dataset.rounds);
      renderSetup();
    });
  });

  document.querySelector("#start-game").addEventListener("click", startGame);
}

function startGame() {
  captureNames();
  const { playerCount, names } = state.setup;
  state.players = PLAYER_STYLES.slice(0, playerCount).map((style, index) => ({
    ...style,
    name: names[index] || style.defaultName,
    score: 0,
    correct: 0,
    attempts: 0,
    hints: 0
  }));
  state.turnIndex = 0;
  state.previousPrompt = "";
  localStorage.setItem("math-race-setup", JSON.stringify(state.setup));
  state.screen = "game";
  prepareQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function prepareQuestion() {
  let question;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    question = generateQuestion({ operation: state.setup.operation, level: state.setup.level });
    if (question.prompt !== state.previousPrompt) break;
  }
  state.currentQuestion = question;
  state.previousPrompt = question.prompt;
  state.hintUsed = false;
  state.answered = false;
  state.selectedAnswer = null;
  state.wasCorrect = false;
  renderGame();
}

function getCurrentPlayerIndex() {
  return state.turnIndex % state.players.length;
}

function renderTrack() {
  const maxScore = state.setup.rounds * 2;
  const currentPlayerIndex = getCurrentPlayerIndex();
  return state.players.map((player, index) => {
    const progress = Math.min(100, (player.score / maxScore) * 100);
    return `
      <div class="track-row">
        <div class="track-player ${index === currentPlayerIndex && !state.answered ? "is-active" : ""}">
          <span class="track-player-name">${escapeHtml(player.name)}</span>
          <span>⭐ ${player.score}</span>
        </div>
        <div class="lane" style="--player-color: ${player.color}; --progress: ${progress}%">
          <div class="lane-fill"></div>
          <span class="lane-runner" aria-hidden="true">${player.avatar}</span>
          <span class="lane-finish" aria-hidden="true">🏁</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderHint(question) {
  if (!state.hintUsed) return "";

  if (question.hintType === "counters") {
    if (question.operation === "addition") {
      const leftDots = Array.from({ length: question.left }, () => '<span class="counter-dot"></span>').join("");
      const rightDots = Array.from({ length: question.right }, () => '<span class="counter-dot second"></span>').join("");
      return `
        <div class="hint-panel" aria-live="polite">
          <p>ลองนับวงกลมทั้งหมดทีละกลุ่ม</p>
          <div class="counter-visual" role="img" aria-label="${question.left} วงกลม บวกอีก ${question.right} วงกลม">
            ${leftDots}${rightDots}
          </div>
        </div>
      `;
    }

    const kept = question.left - question.right;
    const dots = Array.from({ length: question.left }, (_, index) =>
      `<span class="counter-dot ${index >= kept ? "removed" : ""}"></span>`
    ).join("");
    return `
      <div class="hint-panel" aria-live="polite">
        <p>เริ่มจาก ${question.left} แล้วขีดออก ${question.right} เหลือเท่าไร?</p>
        <div class="counter-visual" role="img" aria-label="${question.left} วงกลม ขีดออก ${question.right} วงกลม">
          ${dots}
        </div>
      </div>
    `;
  }

  const leftTens = Math.floor(question.left / 10);
  const leftOnes = question.left % 10;
  const rightTens = Math.floor(question.right / 10);
  const rightOnes = question.right % 10;
  const onesAction = question.operation === "addition"
    ? `เริ่มที่หน่วย: ${leftOnes} + ${rightOnes}`
    : `เริ่มที่หน่วย: ${leftOnes} − ${rightOnes}${leftOnes < rightOnes ? " ต้องแลก 1 สิบก่อน" : ""}`;

  return `
    <div class="hint-panel" aria-live="polite">
      <p>${onesAction} แล้วจึงคิดหลักสิบ</p>
      <div class="place-value" role="img" aria-label="ตารางแยกหลักสิบและหลักหน่วย">
        <div><strong>หลักสิบ</strong><span>${leftTens}</span></div>
        <div><strong>หลักหน่วย</strong><span>${leftOnes}</span></div>
        <div><strong>${question.symbol} หลักสิบ</strong><span>${rightTens}</span></div>
        <div><strong>${question.symbol} หลักหน่วย</strong><span>${rightOnes}</span></div>
      </div>
    </div>
  `;
}

function renderFeedback(question) {
  if (!state.answered) return "";
  const isCorrect = state.wasCorrect;
  const points = state.hintUsed ? 1 : 2;
  return `
    <div class="feedback ${isCorrect ? "is-correct" : "is-wrong"}" role="status">
      <div class="feedback-copy">
        <strong>${isCorrect ? "เยี่ยมมาก!" : "เกือบแล้ว ลองจำวิธีนี้ไว้นะ"}</strong>
        <span>${question.prompt} = ${question.answer}${isCorrect ? ` • เดินหน้า ${points} ช่อง` : " • รอบนี้ยังไม่เดินหน้า"}</span>
      </div>
      <button class="primary-button" id="next-turn" type="button">ตาถัดไป <span aria-hidden="true">→</span></button>
    </div>
  `;
}

function renderGame() {
  document.title = "Math Race Junior — กำลังแข่งขัน";
  const playerIndex = getCurrentPlayerIndex();
  const player = state.players[playerIndex];
  const question = state.currentQuestion;
  const currentRound = Math.floor(state.turnIndex / state.players.length) + 1;
  const totalTurns = state.players.length * state.setup.rounds;

  app.innerHTML = `
    <div class="page game-page">
      <div class="game-meta">
        <span class="round-pill">รอบ ${Math.min(currentRound, state.setup.rounds)} / ${state.setup.rounds}</span>
        <span class="skill-pill">${describeSkill(state.setup.operation, state.setup.level)}</span>
      </div>
      <div class="game-layout">
        <section class="track-card" aria-labelledby="track-title">
          <h2 class="track-title" id="track-title">สนามแข่งขัน</h2>
          <p class="track-subtitle">ผ่านไป ${state.turnIndex} จาก ${totalTurns} ตา • ทุกคนได้เล่นเท่ากัน</p>
          <div class="race-track">${renderTrack()}</div>
        </section>

        <section class="question-card" aria-labelledby="question-title">
          <div class="turn-banner" style="--player-color: ${player.color}">
            <span class="turn-avatar" aria-hidden="true">${player.avatar}</span>
            <div><small>ถึงตาของ</small><strong>${escapeHtml(player.name)}</strong></div>
          </div>
          <p class="question-label" id="question-title">เลือกคำตอบที่ถูกต้อง</p>
          <h1 class="equation">${question.prompt} = ?</h1>
          <div class="answers-grid">
            ${question.choices.map((choice) => {
              const isCorrectChoice = state.answered && choice === question.answer;
              const isWrongChoice = state.answered && choice === state.selectedAnswer && !state.wasCorrect;
              return `
                <button class="answer-button ${isCorrectChoice ? "is-correct" : ""} ${isWrongChoice ? "is-wrong" : ""}"
                  type="button" data-answer="${choice}" ${state.answered ? "disabled" : ""}
                  aria-label="ตอบ ${choice}">${choice}</button>
              `;
            }).join("")}
          </div>
          ${!state.answered ? `
            <div class="question-actions">
              <button class="hint-button" id="show-hint" type="button" ${state.hintUsed ? "disabled" : ""}>
                ${state.hintUsed ? "กำลังแสดงตัวช่วย" : "💡 ดูตัวช่วย (ถูกได้ 1 ช่อง)"}
              </button>
            </div>
          ` : ""}
          ${renderHint(question)}
          ${renderFeedback(question)}
        </section>
      </div>
    </div>
  `;

  app.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => answerQuestion(Number(button.dataset.answer)));
  });
  document.querySelector("#show-hint")?.addEventListener("click", showHint);
  document.querySelector("#next-turn")?.addEventListener("click", nextTurn);
}

function showHint() {
  if (state.hintUsed || state.answered) return;
  state.hintUsed = true;
  state.players[getCurrentPlayerIndex()].hints += 1;
  renderGame();
}

function answerQuestion(answer) {
  if (state.answered) return;
  const player = state.players[getCurrentPlayerIndex()];
  state.selectedAnswer = answer;
  state.wasCorrect = answer === state.currentQuestion.answer;
  state.answered = true;
  player.attempts += 1;

  if (state.wasCorrect) {
    player.correct += 1;
    player.score += state.hintUsed ? 1 : 2;
    playTone("success");
  } else {
    playTone("wrong");
  }

  renderGame();
  requestAnimationFrame(() => document.querySelector("#next-turn")?.focus());
}

function nextTurn() {
  if (!state.answered) return;
  state.turnIndex += 1;
  if (state.turnIndex >= state.players.length * state.setup.rounds) {
    state.screen = "results";
    renderResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  prepareQuestion();
}

function renderResults() {
  document.title = "Math Race Junior — สรุปผล";
  const ranking = [...state.players].sort((a, b) => b.score - a.score || b.correct - a.correct);
  const topScore = ranking[0].score;
  const winners = ranking.filter((player) => player.score === topScore);
  const winnerText = winners.length === 1
    ? `${winners[0].avatar} ${escapeHtml(winners[0].name)} เข้าเส้นชัยอันดับหนึ่ง!`
    : `เสมอกัน ${winners.map((player) => `${player.avatar} ${escapeHtml(player.name)}`).join(" และ ")}!`;

  app.innerHTML = `
    <div class="page results-wrap">
      <section class="result-card">
        <div class="trophy" aria-hidden="true">🏆</div>
        <p class="eyebrow">จบการแข่งขัน</p>
        <h1>เก่งมากทุกคน!</h1>
        <p class="winner-line">${winnerText}</p>

        <div class="scoreboard" aria-label="ตารางผลการแข่งขัน">
          ${ranking.map((player, index) => {
            const accuracy = player.attempts ? Math.round((player.correct / player.attempts) * 100) : 0;
            return `
              <div class="score-row" style="--player-color: ${player.color}">
                <div class="score-rank">${index + 1}</div>
                <div class="score-player">
                  <strong>${player.avatar} ${escapeHtml(player.name)}</strong>
                  <span>ตอบถูก ${player.correct}/${player.attempts} ข้อ (${accuracy}%) • ใช้ตัวช่วย ${player.hints} ครั้ง</span>
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
        <p class="teacher-note">คะแนนใช้เพื่อความสนุกในรอบนี้เท่านั้น ความเร็วไม่ได้เพิ่มคะแนน</p>
      </section>
    </div>
  `;

  document.querySelector("#play-again").addEventListener("click", startGame);
  document.querySelector("#change-settings").addEventListener("click", goHome);
}

function goHome() {
  state.screen = "setup";
  state.players = [];
  renderSetup();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  localStorage.setItem("math-race-sound", state.soundOn ? "on" : "off");
  updateSoundButton();
  if (state.soundOn) playTone("success");
});

homeButton.addEventListener("click", () => {
  if (state.screen === "game" && state.turnIndex > 0 && !window.confirm("ออกจากการแข่งขันรอบนี้และกลับหน้าแรกหรือไม่?")) return;
  goHome();
});

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

render();
