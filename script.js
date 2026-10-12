const BOARD_SIZE = 8;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const GAME_DURATION_SECONDS = 60;
const BEST_SCORE_KEY = 'ten-run-best-score';

const boardElement = document.querySelector('#game-board');
const timerElement = document.querySelector('#timer');
const timerTrack = document.querySelector('#timer-track');
const timerFill = document.querySelector('#timer-fill');
const scoreElement = document.querySelector('#score');
const bestScoreElement = document.querySelector('#best-score');
const selectionSumElement = document.querySelector('#selection-sum');
const statusElement = document.querySelector('#game-status');
const startButton = document.querySelector('#start-button');
const confettiLayer = document.querySelector('#confetti-layer');

const game = {
  values: [],
  score: 0,
  bestScore: loadBestScore(),
  remainingSeconds: GAME_DURATION_SECONDS,
  endTime: 0,
  intervalId: null,
  active: false,
  hasStarted: false,
  dragPointerId: null,
  dragPath: [],
  fallingCells: new Set(),
  animationTimeoutId: null,
  recordCelebrated: false,
};

function randomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function loadBestScore() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(game.bestScore));
  } catch {
    statusElement.textContent = '기록을 저장할 수 없지만 게임은 계속할 수 있어요.';
  }
}

function selectedSum() {
  return game.dragPath.reduce((sum, index) => sum + game.values[index], 0);
}

function updateScoreboard() {
  scoreElement.textContent = String(game.score);
  bestScoreElement.textContent = String(game.bestScore);
}

function updateTimer() {
  const seconds = Math.max(0, game.remainingSeconds);
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsText = String(seconds % 60).padStart(2, '0');

  timerElement.textContent = `${minutesText}:${secondsText}`;
  timerElement.classList.toggle('is-low', seconds <= 10);
  timerTrack.classList.toggle('is-low', seconds <= 10);
  timerTrack.setAttribute('aria-valuenow', String(seconds));
  timerFill.style.width = `${(seconds / GAME_DURATION_SECONDS) * 100}%`;
}

function updateStartButton() {
  const label = game.active ? '새 게임' : game.hasStarted ? '다시 시작' : '게임 시작';
  startButton.querySelector('span').textContent = label;
}

function renderBoard() {
  const selected = new Set(game.dragPath);
  const fragment = document.createDocumentFragment();

  game.values.forEach((value, index) => {
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.type = 'button';
    tile.dataset.index = String(index);
    tile.disabled = !game.active;
    tile.setAttribute('aria-label', `행 ${Math.floor(index / BOARD_SIZE) + 1}, 열 ${(index % BOARD_SIZE) + 1}: ${value}`);
    tile.setAttribute('aria-pressed', String(selected.has(index)));

    const appleIcon = document.createElement('span');
    appleIcon.className = 'apple-icon';
    appleIcon.setAttribute('aria-hidden', 'true');
    appleIcon.textContent = '🍎';
    const tileValue = document.createElement('span');
    tileValue.className = 'tile-value';
    tileValue.textContent = String(value);
    tile.append(appleIcon, tileValue);

    if (selected.has(index)) tile.classList.add('is-selected');
    if (game.fallingCells.has(index)) {
      tile.classList.add('is-falling');
      tile.style.setProperty('--fall-distance', `${game.fallingCells.get(index)}px`);
    }
    fragment.append(tile);
  });

  boardElement.replaceChildren(fragment);
  selectionSumElement.textContent = String(selectedSum());
}

function setStatus(message) {
  statusElement.textContent = message;
}

function dropApples(removedIndexes) {
  const removed = new Set(removedIndexes);
  const nextValues = Array(CELL_COUNT);
  const tileHeight = boardElement.querySelector('.tile')?.getBoundingClientRect().height ?? 0;
  const rowGap = Number.parseFloat(getComputedStyle(boardElement).rowGap) || 0;
  const rowPitch = tileHeight + rowGap;
  const fallingCells = new Map();

  for (let column = 0; column < BOARD_SIZE; column += 1) {
    let targetRow = BOARD_SIZE - 1;

    for (let sourceRow = BOARD_SIZE - 1; sourceRow >= 0; sourceRow -= 1) {
      const sourceIndex = sourceRow * BOARD_SIZE + column;
      if (removed.has(sourceIndex)) continue;

      const targetIndex = targetRow * BOARD_SIZE + column;
      nextValues[targetIndex] = game.values[sourceIndex];
      if (sourceRow !== targetRow) {
        fallingCells.set(targetIndex, (targetRow - sourceRow) * rowPitch);
      }
      targetRow -= 1;
    }

    while (targetRow >= 0) {
      const newIndex = targetRow * BOARD_SIZE + column;
      nextValues[newIndex] = randomNumber();
      fallingCells.set(newIndex, rowPitch);
      targetRow -= 1;
    }
  }

  game.values = nextValues;
  return fallingCells;
}

function showConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#ef7058', '#d6ef72', '#275943', '#f4b942', '#5d9ab3'];
  const pieces = document.createDocumentFragment();

  for (let index = 0; index < 64; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    piece.style.setProperty('--confetti-drift', `${Math.random() * 180 - 90}px`);
    piece.style.setProperty('--confetti-spin', `${Math.random() * 720 - 360}deg`);
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    pieces.append(piece);
  }

  confettiLayer.replaceChildren(pieces);
  window.setTimeout(() => confettiLayer.replaceChildren(), 2200);
}

function startGame() {
  window.clearInterval(game.intervalId);
  window.clearTimeout(game.animationTimeoutId);
  game.values = Array.from({ length: CELL_COUNT }, randomNumber);
  game.score = 0;
  game.remainingSeconds = GAME_DURATION_SECONDS;
  game.endTime = Date.now() + GAME_DURATION_SECONDS * 1000;
  game.active = true;
  game.hasStarted = true;
  game.dragPointerId = null;
  game.dragPath = [];
  game.fallingCells.clear();
  game.recordCelebrated = false;

  updateScoreboard();
  updateTimer();
  updateStartButton();
  renderBoard();
  setStatus('숫자를 이어 합이 10의 배수가 되면 손을 떼세요.');

  game.intervalId = window.setInterval(tick, 200);
}

function tick() {
  game.remainingSeconds = Math.ceil((game.endTime - Date.now()) / 1000);
  if (game.remainingSeconds <= 0) {
    game.remainingSeconds = 0;
    endGame();
    return;
  }
  updateTimer();
}

function endGame() {
  game.active = false;
  game.dragPointerId = null;
  game.dragPath = [];
  window.clearInterval(game.intervalId);
  updateTimer();
  updateStartButton();
  renderBoard();
  setStatus(`시간 종료! 최종 점수는 ${game.score}점이에요.`);
}

function tileIndexFromPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  const tile = target?.closest('.tile');
  return tile && boardElement.contains(tile) ? Number(tile.dataset.index) : null;
}

function areAdjacent(firstIndex, secondIndex) {
  const rowDistance = Math.abs(Math.floor(firstIndex / BOARD_SIZE) - Math.floor(secondIndex / BOARD_SIZE));
  const columnDistance = Math.abs((firstIndex % BOARD_SIZE) - (secondIndex % BOARD_SIZE));
  return rowDistance + columnDistance === 1;
}

function addTileToPath(index) {
  if (game.dragPath.length === 0 || game.dragPath.at(-1) === index) return;

  if (game.dragPath.length > 1 && game.dragPath.at(-2) === index) {
    game.dragPath.pop();
  } else if (!game.dragPath.includes(index) && areAdjacent(game.dragPath.at(-1), index)) {
    game.dragPath.push(index);
  } else {
    return;
  }

  renderBoard();
  const sum = selectedSum();
  setStatus(`선택 합계 ${sum} · 10의 배수에서 손을 떼세요.`);
}

function finishSelection() {
  if (!game.active || game.dragPath.length === 0) return;

  const selectedIndexes = [...game.dragPath];
  const sum = selectedSum();
  game.dragPath = [];
  game.dragPointerId = null;

  if (sum > 0 && sum % 10 === 0) {
    game.fallingCells = dropApples(selectedIndexes);
    game.score += sum;

    if (game.score > game.bestScore) {
      game.bestScore = game.score;
      saveBestScore();
      if (!game.recordCelebrated) {
        game.recordCelebrated = true;
        showConfetti();
      }
    }

    updateScoreboard();
    renderBoard();
    setStatus(`${sum}점 획득! 새로운 숫자를 이어보세요.`);
    window.clearTimeout(game.animationTimeoutId);
    game.animationTimeoutId = window.setTimeout(() => {
      game.fallingCells.clear();
      renderBoard();
    }, 360);
  } else {
    renderBoard();
    setStatus(sum > 0 ? `합계 ${sum}은 10의 배수가 아니에요.` : '숫자를 드래그해 선택하세요.');
  }
}

boardElement.addEventListener('pointerdown', (event) => {
  const index = tileIndexFromPoint(event.clientX, event.clientY);
  if (!game.active || index === null || (event.pointerType === 'mouse' && event.button !== 0)) return;

  event.preventDefault();
  game.dragPointerId = event.pointerId;
  game.dragPath = [index];
  boardElement.setPointerCapture(event.pointerId);
  renderBoard();
  setStatus(`선택 합계 ${selectedSum()} · 10의 배수에서 손을 떼세요.`);
});

boardElement.addEventListener('pointermove', (event) => {
  if (event.pointerId !== game.dragPointerId || !game.active) return;
  event.preventDefault();
  const index = tileIndexFromPoint(event.clientX, event.clientY);
  if (index !== null) addTileToPath(index);
});

boardElement.addEventListener('pointerup', (event) => {
  if (event.pointerId !== game.dragPointerId) return;
  finishSelection();
});

boardElement.addEventListener('pointercancel', (event) => {
  if (event.pointerId !== game.dragPointerId) return;
  game.dragPointerId = null;
  game.dragPath = [];
  renderBoard();
  setStatus('선택이 취소됐어요. 다시 이어보세요.');
});

startButton.addEventListener('click', startGame);

game.values = Array.from({ length: CELL_COUNT }, randomNumber);
updateScoreboard();
updateTimer();
updateStartButton();
renderBoard();