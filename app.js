const CHIP_DEFINITIONS = [
  { value: 1, label: '$1', color: '#dfe3e7', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80' },
  { value: 5, label: '$5', color: '#c4252a', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80' },
  { value: 20, label: '$20', color: '#1e7d53', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80' },
  { value: 100, label: '$100', color: '#111827', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80' },
  { value: 500, label: '$500', color: '#6d28d9', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80' },
  { value: 2000, label: '$2,000', color: '#f59e0b', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80' }
];

const state = {
  screen: 'menu',
  balance: 1000,
  currentBet: 0,
  lastBetAmount: 25,
  settings: {
    showRunningCount: true,
    showDecksRemaining: true,
    showTrueCount: true,
    surrenderEnabled: true,
    insuranceEnabled: true,
    trainingMode: true,
    showHandTotals: true,
    decksInShoe: 6,
    musicVolume: 100,
    sfxVolume: 100,
    dealingSpeed: 80,
    colorScheme: 'mystical-casino',
    depthMode: '3d'
  },
  presetName: 'Training',
  shoe: [],
  dealerHand: [],
  playerHands: [],
  handBets: [],
  activeHandIndex: 0,
  insuranceBet: 0,
  insuranceAvailable: false,
  roundActive: false,
  currentHand: [],
  handStatuses: [],
  strategyState: {
    pool: [],
    mistakes: [],
    currentEntry: null,
    currentHand: [],
    currentDealerCard: null,
    answered: false,
    view: 'practice',
    sessionTotal: 0
  },
  questionnaireState: {
    pool: [],
    mistakes: [],
    currentQuestion: null,
    selected: [],
    answered: false,
    view: 'practice',
    sessionTotal: 0
  },
  chartState: {
    selections: {},
    submitted: false
  },
  countingState: {
    runningCount: 0,
    decksRemaining: 6,
    trueCount: 0
  },
  countingDrill: {
    decksInShoe: 6,
    dealingSpeedMs: 500,
    numHands: 1,
    shoe: [],
    runningCount: 0,
    sessionId: 0,
    isDealing: false
  },
  awaitingBet: false,
  modal: null,
  isDealing: false,
  summaryTimer: null,
  modalHideTimer: null
};

const DEAL_DELAY_MS = 333;
const ROUND_SUMMARY_DELAY_MS = 1000;

function clampSetting(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getDealDelayMs() {
  const pct = clampSetting(Number(state.settings.dealingSpeed ?? 80), 20, 100);
  return 1000 - ((pct - 20) / 80) * 800;
}

const screenMusic = {
  menu: new Audio('Azimuth.mp3'),
  blackjack: new Audio('FatCaps.mp3')
};

const SOUND_EFFECT_VOLUME_MULTIPLIER = 3;
let activeScreenTrack = null;

function startAudioAtOffset(audio, offsetSeconds = 2) {
  if (!audio) return;

  const seekToOffset = () => {
    const targetTime = Number.isFinite(audio.duration) ? Math.min(offsetSeconds, Math.max(0, audio.duration - 0.05)) : offsetSeconds;
    try {
      audio.currentTime = targetTime;
    } catch (error) {
      // Ignore browser timing issues while the file is still initializing.
    }
  };

  if (audio.readyState >= 1) {
    seekToOffset();
    return;
  }

  audio.addEventListener('loadedmetadata', seekToOffset, { once: true });
}

function setupScreenMusic() {
  Object.entries(screenMusic).forEach(([name, audio]) => {
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = ((state.settings.musicVolume ?? 100) / 100) * 0.18;
    audio.muted = false;
  });
}

function unlockAudioOnUserGesture() {
  ensureAudioContext();
  const targetScreen = state.screen === 'intro' ? 'menu' : state.screen;
  if (targetScreen) {
    playScreenMusic(targetScreen);
  }
}

function ensureScreenMusicPlaying(screenName) {
  const resolvedName = screenName === 'rules' || screenName === 'settings' ? 'menu' : screenName;
  const audio = screenMusic[resolvedName];

  if (!audio) return;

  const alreadyPlaying = !audio.paused && !audio.ended;
  if (alreadyPlaying) return;

  audio.volume = ((state.settings.musicVolume ?? 100) / 100) * 0.18;
  startAudioAtOffset(audio, 2);
  audio.play().catch(() => {});
  activeScreenTrack = resolvedName;

  Object.entries(screenMusic).forEach(([name, track]) => {
    if (name !== resolvedName) {
      track.pause();
      track.currentTime = 0;
    }
  });
}

function playScreenMusic(screenName) {
  setupScreenMusic();

  const menuName = screenName === 'rules' || screenName === 'settings' ? 'menu' : screenName;

  if (!menuName || !screenMusic[menuName]) {
    activeScreenTrack = null;
    return;
  }

  const activeAudio = screenMusic[menuName];
  const alreadyPlaying = !activeAudio.paused && !activeAudio.ended;

  Object.entries(screenMusic).forEach(([name, audio]) => {
    if (name === menuName) {
      audio.volume = ((state.settings.musicVolume ?? 100) / 100) * 0.18;
      if (!alreadyPlaying) {
        startAudioAtOffset(audio, 2);
        audio.play().catch(() => {});
      }
      activeScreenTrack = name;
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  });

  if (alreadyPlaying) {
    return;
  }
}

function showModalOverlay() {
  if (!elements.modalOverlay) return;
  if (state.modalHideTimer) {
    clearTimeout(state.modalHideTimer);
    state.modalHideTimer = null;
  }

  elements.modalOverlay.classList.remove('hidden', 'closing');
  void elements.modalOverlay.offsetWidth;
  elements.modalOverlay.classList.add('visible');
}

function hideModal() {
  if (!elements.modalOverlay || elements.modalOverlay.classList.contains('hidden')) return;

  if (state.modalHideTimer) {
    clearTimeout(state.modalHideTimer);
  }

  elements.modalOverlay.classList.remove('visible');
  elements.modalOverlay.classList.add('closing');
  state.modalHideTimer = setTimeout(() => {
    elements.modalOverlay.classList.add('hidden');
    elements.modalOverlay.classList.remove('closing');
    state.modalHideTimer = null;
  }, 180);
}

function clearTableForNewRound() {
  state.dealerHand = [];
  state.playerHands = [];
  renderHand(elements.dealerHand, state.dealerHand, true);
  renderPlayerHands();
}

function showBetSelectionModal() {
  const currentTotal = Number(state.currentBet || 0);
  const balance = Number(state.balance || 0);

  elements.modalTitle.textContent = 'Place Your Bet';
  elements.modalMessage.textContent = `Bankroll: ${formatCurrency(balance)} • Build your wager with chips.`;
  elements.modalActions.innerHTML = '';

  const tray = document.createElement('div');
  tray.className = 'chip-tray chip-tray-modal';

  CHIP_DEFINITIONS.forEach((chip) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bet-chip';
    button.setAttribute('aria-label', `Add ${chip.label} chip`);
    button.style.setProperty('--chip-color', chip.color);
    button.style.setProperty('--chip-photo', `url("${chip.image}")`);
    button.style.setProperty('background', `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.7), rgba(255,255,255,0.18) 18%, transparent 42%), linear-gradient(160deg, rgba(255,255,255,0.18), rgba(0,0,0,0.2)), ${chip.color}`);
    button.style.setProperty('border-radius', '50%');
    button.style.setProperty('border', '4px solid rgba(255,255,255,0.72)');
    button.style.setProperty('width', '82px');
    button.style.setProperty('height', '82px');
    button.style.setProperty('min-width', '82px');
    button.style.setProperty('min-height', '82px');
    button.style.setProperty('padding', '0');
    button.style.setProperty('color', '#fff');
    button.style.setProperty('box-shadow', 'inset 0 0 0 2px rgba(255,255,255,0.28), inset 0 0 26px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.38), 0 0 0 1px rgba(17, 20, 26, 0.4)');
    button.disabled = currentTotal + chip.value > balance;
    button.innerHTML = '<span class="chip-ring"></span><span class="chip-value">' + chip.label + '</span>';

    button.addEventListener('click', () => {
      if (button.disabled) return;
      state.currentBet += chip.value;
      showBetSelectionModal();
    });

    tray.appendChild(button);
  });

  const totalLabel = document.createElement('div');
  totalLabel.className = 'bet-total-inline';
  totalLabel.textContent = `Current bet: ${formatCurrency(currentTotal)}`;

  const controls = document.createElement('div');
  controls.className = 'bet-controls';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'bet-clear-btn';
  clearButton.style.setProperty('background', 'linear-gradient(180deg, #dfe4ea 0%, #bec7d1 16%, #9aa4ad 45%, #69767f 100%)');
  clearButton.style.setProperty('color', '#171a20');
  clearButton.style.setProperty('border', '3px solid rgba(8, 7, 7, 0.96)');
  clearButton.style.setProperty('border-radius', '12px');
  clearButton.style.setProperty('box-shadow', 'inset 0 2px 0 rgba(255,255,255,0.72), inset 0 -4px 0 rgba(75, 46, 10, 0.4), 0 7px 0 rgba(17, 11, 5, 0.94), 0 12px 18px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(199, 150, 53, 0.2)');
  clearButton.textContent = 'Clear';
  clearButton.disabled = currentTotal <= 0;
  clearButton.addEventListener('click', () => {
    state.currentBet = 0;
    showBetSelectionModal();
  });

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'gold-start-btn';
  startButton.style.setProperty('background', 'linear-gradient(180deg, #f6d98b 0%, #e4b75a 20%, #cf9329 45%, #a26a16 100%)');
  startButton.style.setProperty('color', '#190d04');
  startButton.style.setProperty('border', '3px solid rgba(8, 7, 7, 0.96)');
  startButton.style.setProperty('border-radius', '12px');
  startButton.style.setProperty('box-shadow', 'inset 0 2px 0 rgba(255,255,255,0.72), inset 0 -4px 0 rgba(75, 46, 10, 0.4), 0 7px 0 rgba(17, 11, 5, 0.94), 0 12px 18px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(199, 150, 53, 0.2)');
  startButton.textContent = 'Start Hand';
  startButton.disabled = currentTotal <= 0 || currentTotal > balance;
  startButton.addEventListener('click', () => {
    if (startButton.disabled) return;
    hideModal();
    state.awaitingBet = false;
    appendLog(`Bet selected: ${formatCurrency(currentTotal)}`);
    startRound();
  });

  controls.appendChild(clearButton);
  controls.appendChild(startButton);

  elements.modalActions.appendChild(tray);
  elements.modalActions.appendChild(totalLabel);
  elements.modalActions.appendChild(controls);

  showModalOverlay();
  state.awaitingBet = true;
}

function showRoundSummaryModal(summary) {
  const outcomeLower = String(summary.outcome || '').toLowerCase();
  if (outcomeLower.includes('win') || outcomeLower.includes('blackjack') || outcomeLower.includes('dealer bust') || outcomeLower.includes(' +')) {
    playOutcomeSound(true);
  } else if (outcomeLower.includes('loss') || outcomeLower.includes('dealer blackjack') || outcomeLower.includes('surrender') || outcomeLower.includes(' -')) {
    playOutcomeSound(false);
  }

  elements.modalTitle.textContent = 'Round Summary';
  elements.modalMessage.textContent = `${summary.outcome}\n\nDealer: ${summary.dealer}\nPlayer: ${summary.player}\nNet change: ${summary.delta}`;
  elements.modalActions.innerHTML = '';

  const button = document.createElement('button');
  button.textContent = 'Continue';
  button.addEventListener('click', () => {
    hideModal();
    state.awaitingBet = false;
    renderBetPanel();
    if (state.balance > 0) {
      showBetSelectionModal();
    } else {
      resetGame();
      showModal('Out of Money', 'You are out of funds. Starting a fresh bankroll.', ['OK'], () => {
        showBetSelectionModal();
      });
    }
  });

  elements.modalActions.appendChild(button);
  showModalOverlay();
}

function scheduleRoundSummary(summary) {
  if (state.summaryTimer) {
    clearTimeout(state.summaryTimer);
  }

  state.summaryTimer = setTimeout(() => {
    showRoundSummaryModal(summary);
  }, ROUND_SUMMARY_DELAY_MS);
}

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['♠', '♥', '♦', '♣'];
const PAIR_TEN_RANKS = ['10', 'J', 'Q', 'K'];

const elements = {
  menuScreen: document.getElementById('menuScreen'),
  rulesScreen: document.getElementById('rulesScreen'),
  settingsScreen: document.getElementById('settingsScreen'),
  blackjackScreen: document.getElementById('blackjackScreen'),
  basicStrategyScreen: document.getElementById('basicStrategyScreen'),
  cardCountingScreen: document.getElementById('cardCountingScreen'),
  statusLabel: document.getElementById('statusLabel'),
  runningCountBox: document.getElementById('runningCountBox'),
  decksRemainingBox: document.getElementById('decksRemainingBox'),
  trueCountBox: document.getElementById('trueCountBox'),
  balanceBox: document.getElementById('balanceBox'),
  dealerHand: document.getElementById('dealerHand'),
  playerHand: document.getElementById('playerHand'),
  betPanel: document.getElementById('betPanel'),
  strategyFeedback: document.getElementById('strategyFeedback'),
  strategyDealerHand: document.getElementById('strategyDealerHand'),
  strategyPlayerHand: document.getElementById('strategyPlayerHand'),
  strategyHandTotal: document.getElementById('strategyHandTotal'),
  strategyPlayArea: document.getElementById('strategyPlayArea'),
  strategyProgressRow: document.getElementById('strategyProgressRow'),
  strategyProgressFill: document.getElementById('strategyProgressFill'),
  strategyProgressLabel: document.getElementById('strategyProgressLabel'),
  strategyActionGrid: document.getElementById('strategyActionGrid'),
  strategyNextHandBtn: document.getElementById('strategyNextHandBtn'),
  strategyTabPractice: document.getElementById('strategyTabPractice'),
  strategyTabMistakes: document.getElementById('strategyTabMistakes'),
  mistakesCountBadge: document.getElementById('mistakesCountBadge'),
  strategySurrenderToggle: document.getElementById('strategySurrenderToggle'),
  strategyMistakesPanel: document.getElementById('strategyMistakesPanel'),
  strategyMistakesEmpty: document.getElementById('strategyMistakesEmpty'),
  strategyMistakesList: document.getElementById('strategyMistakesList'),
  strategyPracticeMistakesBtn: document.getElementById('strategyPracticeMistakesBtn'),
  strategyBackToListBtn: document.getElementById('strategyBackToListBtn'),
  quizTabPractice: document.getElementById('quizTabPractice'),
  quizTabMistakes: document.getElementById('quizTabMistakes'),
  quizMistakesCountBadge: document.getElementById('quizMistakesCountBadge'),
  quizSurrenderToggle: document.getElementById('quizSurrenderToggle'),
  quizProgressRow: document.getElementById('quizProgressRow'),
  quizProgressFill: document.getElementById('quizProgressFill'),
  quizProgressLabel: document.getElementById('quizProgressLabel'),
  quizPlayArea: document.getElementById('quizPlayArea'),
  quizTypeTag: document.getElementById('quizTypeTag'),
  quizPrompt: document.getElementById('quizPrompt'),
  quizOptions: document.getElementById('quizOptions'),
  quizSubmitBtn: document.getElementById('quizSubmitBtn'),
  quizFeedback: document.getElementById('quizFeedback'),
  quizNextBtn: document.getElementById('quizNextBtn'),
  quizMistakesPanel: document.getElementById('quizMistakesPanel'),
  quizMistakesEmpty: document.getElementById('quizMistakesEmpty'),
  quizMistakesList: document.getElementById('quizMistakesList'),
  quizPracticeMistakesBtn: document.getElementById('quizPracticeMistakesBtn'),
  quizBackToListBtn: document.getElementById('quizBackToListBtn'),
  chartSurrenderToggle: document.getElementById('chartSurrenderToggle'),
  chartLegend: document.getElementById('chartLegend'),
  chartScoreBanner: document.getElementById('chartScoreBanner'),
  chartTablesContainer: document.getElementById('chartTablesContainer'),
  chartSubmitBtn: document.getElementById('chartSubmitBtn'),
  chartResetBtn: document.getElementById('chartResetBtn'),
  countingRunningDrillScreen: document.getElementById('countingRunningDrillScreen'),
  drillDecksSelect: document.getElementById('drillDecksSelect'),
  drillSpeedSlider: document.getElementById('drillSpeedSlider'),
  drillSpeedValue: document.getElementById('drillSpeedValue'),
  drillHandsSlider: document.getElementById('drillHandsSlider'),
  drillHandsValue: document.getElementById('drillHandsValue'),
  drillStatus: document.getElementById('drillStatus'),
  drillDealerHand: document.getElementById('drillDealerHand'),
  drillPlayerHands: document.getElementById('drillPlayerHands'),
  drillResetBtn: document.getElementById('drillResetBtn'),
  gameDealingSpeedSlider: document.getElementById('gameDealingSpeedSlider'),
  gameDealingSpeedValue: document.getElementById('gameDealingSpeedValue'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalActions: document.getElementById('modalActions')
};

document.addEventListener('DOMContentLoaded', () => {
  bindStaticEvents();
  init();
});

function applyColorScheme(scheme) {
  document.documentElement.dataset.theme = scheme === 'classic-casino' ? 'classic-casino' : 'mystical-casino';
}

function applyDepthMode(mode) {
  document.documentElement.dataset.depth = mode === 'flat' ? 'flat' : '3d';
}

function init() {
  state.settings = { ...state.settings };
  state.shoe = createShoe(state.settings.decksInShoe);
  applyColorScheme(state.settings.colorScheme);
  applyDepthMode(state.settings.depthMode);
  setupScreenMusic();
  updateHud();
  renderRulesScreen();
  renderSettingsScreen();
  renderScreen('intro');
  renderBetPanel();
  renderStrategyScreen();
  renderQuestionnaireScreen();
  renderChartsScreen();
  appendLog('Blackjack Terminus ready.');
}

function ensureAudioContext() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  if (!window.__blackjackButtonAudio) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    window.__blackjackButtonAudio = new AudioCtor();
  }

  const audioCtx = window.__blackjackButtonAudio;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playButtonTone({ frequency, duration, volume, type, sweep }) {
  const audioCtx = ensureAudioContext();
  if (!audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type || 'triangle';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  if (sweep) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, frequency + sweep),
      audioCtx.currentTime + duration
    );
  }

  const effectVolume = ((volume || 0.03) * SOUND_EFFECT_VOLUME_MULTIPLIER) * ((state.settings.sfxVolume ?? 100) / 100);
  gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.min(0.9, effectVolume), audioCtx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  oscillator.connect(gainNode).connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function playHoverSound() {
  const now = Date.now();
  if (!window.__blackjackHoverStamp || now - window.__blackjackHoverStamp > 90) {
    window.__blackjackHoverStamp = now;
    playButtonTone({ frequency: 260, duration: 0.12, volume: 0.08, type: 'sine', sweep: 26 });
  }
}

function playPressSound() {
  playButtonTone({ frequency: 140, duration: 0.18, volume: 0.22, type: 'triangle', sweep: 18 });
  setTimeout(() => {
    playButtonTone({ frequency: 100, duration: 0.14, volume: 0.14, type: 'sine', sweep: 10 });
  }, 22);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function playCardDealingSound() {
  const audioCtx = ensureAudioContext();
  if (!audioCtx) return;

  const duration = 0.18;
  const sampleRate = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.012);
    const release = Math.max(0, 1 - t / duration);
    const swish = (Math.random() * 2 - 1) * 0.22;
    const friction = Math.sin(2 * Math.PI * 420 * t) * 0.18;
    const air = Math.sin(2 * Math.PI * 160 * t) * 0.12;
    data[i] = (swish + friction + air) * attack * release;
  }

  const source = audioCtx.createBufferSource();
  const lowPass = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  source.buffer = buffer;
  lowPass.type = 'lowpass';
  lowPass.frequency.setValueAtTime(2200, audioCtx.currentTime);
  lowPass.Q.value = 0.8;

  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.42, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  source.connect(lowPass);
  lowPass.connect(gain);
  gain.connect(audioCtx.destination);

  source.start();
  source.stop(audioCtx.currentTime + duration);
}

function playOutcomeSound(isWin) {
  const audioCtx = ensureAudioContext();
  if (!audioCtx) return;

  const tones = isWin ? [523, 659, 784] : [247, 196, 146];

  tones.forEach((frequency, index) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const startAt = audioCtx.currentTime + index * 0.12;

    oscillator.type = isWin ? 'triangle' : 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, startAt);

    const outcomeVolume = isWin ? 0.32 : 0.24;
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(outcomeVolume, startAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);

    oscillator.connect(gainNode).connect(audioCtx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.24);
  });
}

function triggerCardDealAnimation(container, cardIndex = -1) {
  const cards = container.querySelectorAll('.card');
  const targetCard = cardIndex >= 0 ? cards[cardIndex] : cards[cards.length - 1];
  if (!targetCard) return;

  targetCard.classList.remove('dealt');
  void targetCard.offsetWidth;
  targetCard.classList.add('dealt');
}

function getPlayerHandContainer(handIndex = state.activeHandIndex) {
  const wrappers = elements.playerHand ? elements.playerHand.querySelectorAll('.split-hand') : [];
  return wrappers[handIndex] || elements.playerHand;
}

async function dealCardToHand(target, hand, card, handIndex = 0) {
  hand.push(card);

  if (target === 'dealer') {
    renderHand(elements.dealerHand, state.dealerHand, true);
    triggerCardDealAnimation(elements.dealerHand, state.dealerHand.length - 1);
  } else {
    renderPlayerHands();
    const handContainer = getPlayerHandContainer(handIndex);
    triggerCardDealAnimation(handContainer, hand.length - 1);
  }

  playCardDealingSound();
  await wait(getDealDelayMs());
}

function bindButtonFeedback() {
  document.addEventListener('pointerover', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    unlockAudioOnUserGesture();
    playHoverSound();
  });

  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (event.button !== undefined && event.button !== 0) return;
    unlockAudioOnUserGesture();
    playPressSound();
  });

  document.addEventListener('keydown', (event) => {
    const focused = document.activeElement;
    if (focused && focused.tagName === 'BUTTON') {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        unlockAudioOnUserGesture();
        playPressSound();
      }
    }
  });

  document.addEventListener('pointerdown', unlockAudioOnUserGesture, { once: true });
  document.addEventListener('click', unlockAudioOnUserGesture, { once: true });
  document.addEventListener('keydown', unlockAudioOnUserGesture, { once: true });
}

function bindStaticEvents() {
  bindButtonFeedback();

  document.querySelectorAll('[data-screen]').forEach((button) => {
    button.addEventListener('click', () => {
      const screen = button.dataset.screen;
      if (screen === 'blackjack') {
        renderScreen('blackjack');
        showBetSelectionModal();
        return;
      }
      if (screen) renderScreen(screen);
      syncSharedStrategyToggles();
    });
  });

  const quitBtn = document.getElementById('quitBtn');
  if (quitBtn) {
    quitBtn.addEventListener('click', () => {
      showModal('Quit', 'Are you sure you want to quit?', ['Yes', 'No'], (choice) => {
        if (choice === 0) window.close();
      });
    });
  }

  document.getElementById('hitBtn').addEventListener('click', () => handleAction('H'));
  document.getElementById('standBtn').addEventListener('click', () => handleAction('S'));
  document.getElementById('doubleBtn').addEventListener('click', () => handleAction('D'));
  document.getElementById('splitBtn').addEventListener('click', () => handleAction('P'));
  document.getElementById('surrenderBtn').addEventListener('click', () => handleAction('R'));
  document.getElementById('insuranceBtn').addEventListener('click', () => handleAction('I'));
  document.getElementById('presetBtn').addEventListener('click', choosePreset);
  document.getElementById('menuBtn').addEventListener('click', () => renderScreen('menu'));
  document.getElementById('enterGameBtn').addEventListener('click', () => {
    playScreenMusic('menu');
    unlockAudioOnUserGesture();
    renderScreen('menu');
  });

  bindStrategyTrainerEvents();
  bindQuestionnaireEvents();
  bindChartsEvents();

  bindCountingDrillEvents();
  bindGameDealingSpeedSlider();
}

function renderScreen(name) {
  const previousScreen = state.screen;
  state.screen = name;
  const current = document.querySelector('.screen.active');
  const camelName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const target = document.getElementById(`${camelName}Screen`);

  if (name === 'intro') {
    playScreenMusic(null);
  } else if (name === 'menu' || name === 'blackjack' || name === 'rules' || name === 'settings') {
    if (name === 'rules' || name === 'settings') {
      ensureScreenMusicPlaying('menu');
    } else {
      ensureScreenMusicPlaying(name);
    }
  } else {
    playScreenMusic(null);
  }

  if (previousScreen === 'counting-running-drill' && name !== 'counting-running-drill') {
    pauseDrillSession();
  }

  if (name === 'counting-running-drill' && previousScreen !== 'counting-running-drill') {
    ensureDrillStarted();
  }

  if (current && current !== target) {
    current.classList.remove('active');
    current.classList.add('exiting');
    setTimeout(() => current.classList.remove('exiting'), 220);
  }

  if (target) {
    target.classList.remove('exiting');
    target.classList.remove('hidden');
    target.classList.add('active');
    void target.offsetWidth;
    target.classList.add('animate-in');
    setTimeout(() => target.classList.remove('animate-in'), 260);
  }

  if (name === 'blackjack' && !state.roundActive && !state.awaitingBet) {
    showBetSelectionModal();
  }
}

function renderBetPanel() {
  const panel = elements.betPanel;
  if (!panel) return;

  panel.innerHTML = '';

  const totalBet = Number(state.currentBet || 0);
  const balance = Number(state.balance || 0);
  const roundLocked = state.roundActive || state.isDealing;

  const summary = document.createElement('div');
  summary.className = 'bet-summary';
  summary.innerHTML = `
    <div class="bet-total-label">Current bet</div>
    <div class="bet-total-value">${formatCurrency(totalBet)}</div>
    <div class="bet-remaining">Bankroll: ${formatCurrency(balance)}</div>
  `;
  panel.appendChild(summary);

  if (roundLocked) {
    const disabledNote = document.createElement('div');
    disabledNote.className = 'bet-status-note';
    disabledNote.textContent = 'Betting is locked while the hand is in progress.';
    panel.appendChild(disabledNote);
  }
}

function renderPlayerHandTotal() {
  const totalDisplay = document.getElementById('playerHandTotal');
  if (!totalDisplay) return;

  if (!state.settings.showHandTotals) {
    totalDisplay.textContent = '';
    totalDisplay.style.display = 'none';
    return;
  }

  totalDisplay.style.display = 'inline-block';

  const hand = getActiveHand();
  if (!hand || hand.length === 0) {
    totalDisplay.textContent = '0';
    return;
  }

  const total = scoreHand(hand);
  const softLabel = hasSoftTotal(hand) ? `soft ${total}` : `${total}`;
  totalDisplay.textContent = softLabel;
}

function updateHud() {
  const runningCount = calculateRunningCount();
  const remainingCards = state.shoe.length;
  const decksRemaining = remainingCards > 0 ? remainingCards / 52 : 0;

  state.countingState.runningCount = runningCount;
  state.countingState.decksRemaining = decksRemaining;
  state.countingState.trueCount = decksRemaining > 0 ? runningCount / decksRemaining : 0;

  elements.statusLabel.textContent = `Preset: ${state.presetName || (state.settings.trainingMode ? 'Training' : 'True Game')} | Balance: ${formatCurrency(state.balance)}`;
  elements.runningCountBox.textContent = `Running count: ${runningCount}`;
  elements.decksRemainingBox.textContent = `Decks remaining: ${decksRemaining.toFixed(2)}`;
  elements.trueCountBox.textContent = `True count: ${state.countingState.trueCount.toFixed(2)}`;
  elements.balanceBox.textContent = `Balance: ${formatCurrency(state.balance)}`;

  elements.runningCountBox.classList.toggle('hidden', !state.settings.showRunningCount);
  elements.decksRemainingBox.classList.toggle('hidden', !state.settings.showDecksRemaining);
  elements.trueCountBox.classList.toggle('hidden', !state.settings.showTrueCount);

  if (!state.isDealing) {
    renderHand(elements.dealerHand, state.dealerHand, true);
    renderPlayerHands();
  }

  renderPlayerHandTotal();
  updateActionButtons();
}

function updateActionButtons() {
  const activeHand = getActiveHand();
  const canSplit = activeHand && activeHand.length === 2 && activeHand[0].rank === activeHand[1].rank;
  const canDouble = activeHand && activeHand.length === 2 && state.currentBet <= state.balance;
  const isRoundActive = state.roundActive;
  const insuranceEligible = state.settings.insuranceEnabled && state.insuranceAvailable && state.dealerHand[0]?.rank === 'A' && isRoundActive && !state.awaitingBet;

  document.getElementById('hitBtn').disabled = !isRoundActive || state.awaitingBet;
  document.getElementById('standBtn').disabled = !isRoundActive || state.awaitingBet;
  document.getElementById('doubleBtn').disabled = !isRoundActive || !canDouble || state.awaitingBet;
  document.getElementById('splitBtn').disabled = !isRoundActive || !canSplit || state.awaitingBet;
  document.getElementById('surrenderBtn').disabled = !isRoundActive || !state.settings.surrenderEnabled || state.awaitingBet;
  document.getElementById('insuranceBtn').disabled = !insuranceEligible || state.balance < (state.handBets[state.activeHandIndex] || 0) / 2;
}

function renderPlayerHands() {
  const container = elements.playerHand;
  container.innerHTML = '';

  if (!state.playerHands || state.playerHands.length === 0) return;

  state.playerHands.forEach((hand, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = `split-hand ${index === state.activeHandIndex ? 'active' : 'inactive'}`;
    wrapper.innerHTML = hand
      .map((card) => {
        const classes = ['card'];
        if (card.suit === '♥' || card.suit === '♦') classes.push('red');
        return `<div class="${classes.join(' ')}">${cardToText(card)}</div>`;
      })
      .join('');
    container.appendChild(wrapper);
  });

  renderPlayerHandTotal();
}

function renderHand(container, hand, hideHoleCard) {
  if (!hand) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = hand
    .map((card, index) => {
      const hide = hideHoleCard && index === 1 && hand.length > 1 && state.roundActive;
      const text = hide ? '??' : cardToText(card);
      const classes = ['card'];
      if (card.suit === '♥' || card.suit === '♦') classes.push('red');
      if (hide) classes.push('back');
      return `<div class="${classes.join(' ')}">${text}</div>`;
    })
    .join('');
}

function cardToText(card) {
  return `${card.rank}${card.suit}`;
}

function createCard(rank, suit) {
  return {
    rank,
    suit,
    value: rankToValue(rank)
  };
}

function rankToValue(rank) {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return Number(rank);
}

function createShoe(deckCount) {
  const shoe = [];
  for (let deck = 0; deck < deckCount; deck++) {
    suits.forEach((suit) => {
      ranks.forEach((rank) => shoe.push(createCard(rank, suit)));
    });
  }
  shuffle(shoe);
  return shoe;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getCardCountingValue(card) {
  if (!card) return 0;
  if (card.rank === 'A') return -1;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return -1;
  if (Number(card.rank) >= 2 && Number(card.rank) <= 6) return 1;
  return 0;
}

function updateCountingFromCard(card) {
  if (!card) return;

  const cardValue = getCardCountingValue(card);
  state.countingState.runningCount += cardValue;
  const cardsRemaining = state.shoe.length;
  state.countingState.decksRemaining = cardsRemaining > 0 ? cardsRemaining / 52 : 0;
  state.countingState.trueCount = state.countingState.decksRemaining > 0 ? state.countingState.runningCount / state.countingState.decksRemaining : 0;
}

function drawCard({ countTowardsRunningCount = true } = {}) {
  if (state.shoe.length === 0) {
    state.shoe = createShoe(state.settings.decksInShoe);
    state.countingState.runningCount = 0;
    appendLog('Shoe reshuffled.');
  }

  const card = state.shoe.pop();
  card._counted = !countTowardsRunningCount ? false : true;

  if (countTowardsRunningCount) {
    updateCountingFromCard(card);
  }

  return card;
}

async function startRound() {
  if (state.isDealing) return;
  if (state.balance <= 0) {
    state.roundActive = false;
    appendLog('You are out of money. Game over.');
    return;
  }

  if (state.currentBet <= 0) {
    appendLog('Choose a bet before dealing.');
    return;
  }

  if (state.currentBet > state.balance) {
    appendLog('Your bet cannot exceed your balance.');
    return;
  }

  state.isDealing = true;
  state.dealerHand = [];
  state.playerHands = [];
  renderHand(elements.dealerHand, state.dealerHand, true);
  renderPlayerHands();
  state.handBets = [];
  state.handStatuses = [];
  state.activeHandIndex = 0;
  state.insuranceBet = 0;
  state.roundActive = true;
  renderBetPanel();

  const playerHand = [];
  const dealerHand = [];
  state.playerHands.push(playerHand);
  state.handBets.push(state.currentBet);
  state.handStatuses = [false];
  state.dealerHand = dealerHand;
  state.currentHand = playerHand;

  updateHud();
  await wait(500);

  await dealCardToHand('player', playerHand, drawCard(), 0);
  await dealCardToHand('dealer', dealerHand, drawCard(), 0);
  await dealCardToHand('player', playerHand, drawCard(), 0);
  await dealCardToHand('dealer', dealerHand, drawCard({ countTowardsRunningCount: false }), 0);

  const playerBlackjack = playerHand.length === 2 && scoreHand(playerHand) === 21;
  const dealerBlackjack = dealerHand.length === 2 && scoreHand(dealerHand) === 21;
  const dealerShownAce = dealerHand[0]?.rank === 'A' && state.settings.insuranceEnabled;

  if (dealerShownAce && !playerBlackjack) {
    state.insuranceAvailable = true;
    appendLog('Dealer shows an Ace. Insurance is available.');
  }

  if (playerBlackjack || (dealerBlackjack && !dealerShownAce)) {
    const bet = state.currentBet;
    const insurancePayout = (state.insuranceBet || 0) * 2;
    let delta = 0;
    let outcome = 'Push';

    if (playerBlackjack && !dealerBlackjack) {
      delta = bet * 1.5;
      outcome = 'Blackjack';
      appendLog(`Player blackjack pays 3:2 (+$${delta.toFixed(2)})`);
    } else if (dealerBlackjack && !playerBlackjack) {
      delta = -bet + insurancePayout;
      outcome = 'Dealer blackjack';
      appendLog(`Dealer blackjack. -$${bet.toFixed(2)}`);
      if (state.insuranceBet > 0) {
        appendLog(`Insurance pays 2:1 (+$${insurancePayout.toFixed(2)})`);
      }
    } else {
      delta = insurancePayout;
      outcome = 'Push';
      appendLog('Both dealer and player have blackjack. Push.');
      if (state.insuranceBet > 0) {
        appendLog(`Insurance wins (+$${insurancePayout.toFixed(2)})`);
      }
    }

    state.balance += delta;
    state.currentBet = 0;
    state.insuranceBet = 0;
    state.insuranceAvailable = false;
    state.roundActive = false;
    state.isDealing = false;
    updateHud();
    appendLog('Round complete. Net change: ' + formatSignedCurrency(delta));
    renderBetPanel();

    const dealerText = state.dealerHand.map(cardToText).join(' ');
    const playerText = state.playerHands[0].map(cardToText).join(' ');
    await wait(ROUND_SUMMARY_DELAY_MS);
    showRoundSummaryModal({
      outcome: `${outcome} — ${formatSignedCurrency(delta)}`,
      dealer: dealerText,
      player: playerText,
      delta: formatSignedCurrency(delta)
    });
    return;
  }

  if (state.settings.trainingMode) {
    const recommendation = recommendBasicStrategy(playerHand, dealerHand[0]);
    appendLog(`Training hint: ${describeAction(recommendation)}.`);
  }

  state.insuranceBet = 0;

  if (dealerHand[0].rank === 'A' && state.settings.insuranceEnabled && !playerBlackjack) {
    state.insuranceAvailable = true;
    appendLog('Dealer shows an Ace. Insurance is available.');
  }

  state.isDealing = false;
  updateHud();
  appendLog('Round started.');
}

function getActiveHand() {
  return state.playerHands[state.activeHandIndex] || [];
}

function getNextUnfinishedHandIndex(startIndex = state.activeHandIndex) {
  for (let i = startIndex + 1; i < state.playerHands.length; i++) {
    if (!state.handStatuses[i]) return i;
  }

  for (let i = 0; i <= startIndex; i++) {
    if (!state.handStatuses[i]) return i;
  }

  return -1;
}

function advanceToNextHand() {
  const nextIndex = getNextUnfinishedHandIndex();
  if (nextIndex >= 0) {
    state.activeHandIndex = nextIndex;
    state.roundActive = true;
    updateHud();
    return true;
  }

  state.roundActive = false;
  resolveDealerTurn();
  return false;
}

async function handleAction(action) {
  if (state.isDealing) return;
  const hand = getActiveHand();
  if (!state.roundActive || !hand) return;

  if (action === 'I') {
    if (!state.insuranceAvailable || !state.settings.insuranceEnabled || state.dealerHand[0]?.rank !== 'A') {
      appendLog('Insurance is not available right now.');
      return;
    }

    const insuranceCost = state.handBets[state.activeHandIndex] / 2;
    if (insuranceCost <= 0) {
      appendLog('No valid insurance bet is available for this hand.');
      return;
    }

    if (insuranceCost > state.balance) {
      appendLog('Not enough money to buy insurance.');
      return;
    }

    state.balance -= insuranceCost;
    state.insuranceBet = insuranceCost;
    state.insuranceAvailable = false;
    appendLog(`Player buys insurance for $${insuranceCost.toFixed(2)}.`);
    if (scoreHand(state.dealerHand) === 21) {
      renderHand(elements.dealerHand, state.dealerHand, false);
      state.roundActive = false;
      state.isDealing = true;
      await settleRound();
      return;
    }
    updateHud();
    return;
  }

  if (state.insuranceAvailable && !state.insuranceBet) {
    state.insuranceAvailable = false;
    appendLog('Insurance declined. Reveal dealer hole card to continue.');
    renderHand(elements.dealerHand, state.dealerHand, false);
    if (scoreHand(state.dealerHand) === 21) {
      state.roundActive = false;
      state.isDealing = true;
      await settleRound();
      return;
    }
  }

  const applyAction = async () => {
    if (action === 'R') {
      if (!state.settings.surrenderEnabled) {
        appendLog('Surrender is disabled in this preset.');
        return;
      }

      const surrenderLoss = state.handBets[state.activeHandIndex] / 2;
      state.roundActive = false;
      state.balance -= surrenderLoss;
      state.currentBet = 0;
      state.handBets[state.activeHandIndex] = 0;
      state.handStatuses[state.activeHandIndex] = true;
      appendLog(`Player surrendered. -$${surrenderLoss.toFixed(2)}`);
      updateHud();
      renderBetPanel();
      await wait(ROUND_SUMMARY_DELAY_MS);
      showRoundSummaryModal({
        outcome: `Surrender — -$${surrenderLoss.toFixed(2)}`,
        dealer: state.dealerHand.map(cardToText).join(' '),
        player: hand.map(cardToText).join(' '),
        delta: `-$${surrenderLoss.toFixed(2)}`
      });
      return;
    }

    if (action === 'D') {
      const bet = state.handBets[state.activeHandIndex];
      if (bet > state.balance) {
        appendLog('Not enough money to double.');
        return;
      }
    }

    if (action === 'P' && !canSplit(hand)) {
      appendLog('This hand cannot split.');
      return;
    }

    if (action === 'H') {
      state.isDealing = true;
      await dealCardToHand('player', hand, drawCard(), state.activeHandIndex);
      state.isDealing = false;
      if (scoreHand(hand) > 21) {
        state.handStatuses[state.activeHandIndex] = true;
        appendLog('Player busts.');
        advanceToNextHand();
        updateHud();
        return;
      }
      appendLog('Player hits.');
    }

    if (action === 'S') {
      state.handStatuses[state.activeHandIndex] = true;
      appendLog('Player stands.');
      advanceToNextHand();
      updateHud();
      return;
    }

    if (action === 'D') {
      const bet = state.handBets[state.activeHandIndex];
      state.handBets[state.activeHandIndex] = bet * 2;
      state.isDealing = true;
      await dealCardToHand('player', hand, drawCard(), state.activeHandIndex);
      state.isDealing = false;
      state.handStatuses[state.activeHandIndex] = true;
      appendLog('Player doubles and draws one card.');
      advanceToNextHand();
      updateHud();
      return;
    }

    if (action === 'P') {
      const bet = state.handBets[state.activeHandIndex];
      const left = [hand[0]];
      const right = [hand[1]];
      state.playerHands = [left, right];
      state.handBets = [bet, bet];
      state.handStatuses = [false, false];
      state.activeHandIndex = 0;
      state.roundActive = true;
      state.isDealing = true;
      appendLog('Player splits and draws one card to each hand.');
      await dealCardToHand('player', left, drawCard(), 0);
      await dealCardToHand('player', right, drawCard(), 1);
      state.isDealing = false;
      updateHud();
      return;
    }

    updateHud();
  };

  if (state.settings.trainingMode) {
    const recommendation = recommendBasicStrategy(hand, state.dealerHand[0]);
    const actual = describeAction(action);
    if (action !== recommendation) {
      showModal(
        'Basic Strategy Hint',
        `You chose to ${actual}. The correct move here is ${describeAction(recommendation)} against a ${state.dealerHand[0].rank}${state.dealerHand[0].suit} upcard.`,
        ['Continue'],
        () => applyAction()
      );
      return;
    }
  }

  await applyAction();
}

async function resolveDealerTurn() {
  if (state.playerHands.some((hand, index) => !state.handStatuses[index] && scoreHand(hand) <= 21)) {
    return;
  }

  state.isDealing = true;

  if (state.dealerHand.length > 1 && state.dealerHand[1] && state.dealerHand[1]._counted === false) {
    updateCountingFromCard(state.dealerHand[1]);
    state.dealerHand[1]._counted = true;
  }

  if (state.dealerHand.length > 0) {
    await wait(getDealDelayMs());
    renderHand(elements.dealerHand, state.dealerHand, false);
  }

  while (scoreHand(state.dealerHand) < 17) {
    await wait(getDealDelayMs());
    state.dealerHand.push(drawCard());
    renderHand(elements.dealerHand, state.dealerHand, true);
    triggerCardDealAnimation(elements.dealerHand, state.dealerHand.length - 1);
    playCardDealingSound();
    appendLog('Dealer hits.');
    updateHud();
    await wait(getDealDelayMs());
  }
  state.isDealing = false;
  await settleRound();
}

async function settleRound() {
  const dealerTotal = scoreHand(state.dealerHand);
  const dealerHasBlackjack = state.dealerHand.length === 2 && dealerTotal === 21;
  let totalDelta = 0;
  let lastOutcome = 'Push';

  state.playerHands.forEach((hand, index) => {
    const bet = state.handBets[index];
    const playerTotal = scoreHand(hand);

    if (playerTotal > 21) {
      totalDelta -= bet;
      lastOutcome = 'Loss';
      appendLog(`Hand ${index + 1}: bust (-$${bet.toFixed(2)})`);
    } else if (dealerTotal > 21) {
      totalDelta += bet;
      lastOutcome = 'Win';
      appendLog(`Hand ${index + 1}: dealer bust (+$${bet.toFixed(2)})`);
    } else if (playerTotal > dealerTotal) {
      totalDelta += bet;
      lastOutcome = 'Win';
      appendLog(`Hand ${index + 1}: win (+$${bet.toFixed(2)})`);
    } else if (playerTotal < dealerTotal) {
      totalDelta -= bet;
      lastOutcome = 'Loss';
      appendLog(`Hand ${index + 1}: loss (-$${bet.toFixed(2)})`);
    } else {
      appendLog(`Hand ${index + 1}: push`);
    }
  });

  if (state.insuranceBet > 0) {
    if (dealerHasBlackjack) {
      totalDelta += state.insuranceBet * 2;
      appendLog(`Insurance pays 2:1 (+$${(state.insuranceBet * 2).toFixed(2)})`);
    } else {
      totalDelta -= state.insuranceBet;
      appendLog(`Insurance loses (-$${state.insuranceBet.toFixed(2)})`);
    }
  }

  state.balance += totalDelta;
  state.currentBet = 0;
  state.insuranceBet = 0;
  state.insuranceAvailable = false;
  state.roundActive = false;

  updateHud();
  appendLog(`Round complete. Net change: ${formatSignedCurrency(totalDelta)}`);
  renderBetPanel();

  const dealerText = state.dealerHand.map(cardToText).join(' ');
  const playerText = getActiveHand().map(cardToText).join(' ');
  await wait(ROUND_SUMMARY_DELAY_MS);
  showRoundSummaryModal({
    outcome: `${lastOutcome} — ${formatSignedCurrency(totalDelta)}`,
    dealer: dealerText,
    player: playerText,
    delta: formatSignedCurrency(totalDelta)
  });
}

function scoreHand(hand) {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    total += card.value;
    if (card.rank === 'A') aces += 1;
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function hasSoftTotal(hand) {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    total += card.value;
    if (card.rank === 'A') aces += 1;
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return aces > 0 && total <= 21;
}

function canSplit(hand) {
  return hand.length === 2 && hand[0].rank === hand[1].rank;
}

const basicStrategyDatabase = {
  hard: {
    5: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    6: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    7: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    8: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    9: { 2: 'H', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    10: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'H', 11: 'H' },
    11: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'D', 11: 'H' },
    12: { 2: 'H', 3: 'H', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    13: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    14: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    15: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'R', 11: 'R' },
    16: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'R', 10: 'R', 11: 'R' },
    17: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    18: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    19: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    20: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    21: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' }
  },
  soft: {
    13: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    14: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    15: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    16: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    17: { 2: 'H', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    18: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'S', 8: 'S', 9: 'H', 10: 'H', 11: 'H' },
    19: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'D', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    20: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    21: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' }
  },
  pairs: {
    A: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'P', 10: 'P', 11: 'P' },
    2: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    3: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    4: { 2: 'H', 3: 'H', 4: 'H', 5: 'P', 6: 'P', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    5: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'H', 11: 'H' },
    6: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    7: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    8: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'P', 10: 'P', 11: 'P' },
    9: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'S', 8: 'P', 9: 'P', 10: 'S', 11: 'S' },
    10: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    J: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    Q: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    K: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' }
  }
};

function buildStrategyCatalog() {
  const catalog = [];
  const dealerValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  Object.keys(basicStrategyDatabase.hard).forEach((total) => {
    const totalValue = Number(total);
    if (totalValue > 20) return; // Not reachable as a fresh 2-card hand.
    dealerValues.forEach((dealerValue) => {
      catalog.push({ id: `hard-${totalValue}-${dealerValue}`, kind: 'hard', total: totalValue, dealer: dealerValue, move: basicStrategyDatabase.hard[totalValue][dealerValue] || 'H' });
    });
  });

  Object.keys(basicStrategyDatabase.soft).forEach((total) => {
    const totalValue = Number(total);
    if (totalValue > 20) return; // Soft 21 is a natural blackjack, not a decision point.
    dealerValues.forEach((dealerValue) => {
      catalog.push({ id: `soft-${totalValue}-${dealerValue}`, kind: 'soft', total: totalValue, dealer: dealerValue, move: basicStrategyDatabase.soft[totalValue][dealerValue] || 'H' });
    });
  });

  // 10, J, Q, K are all 10-value cards with identical pair strategy, so they
  // collapse into a single '10' training entry instead of 4 redundant ones.
  const pairRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  pairRanks.forEach((rank) => {
    dealerValues.forEach((dealerValue) => {
      catalog.push({ id: `pair-${rank}-${dealerValue}`, kind: 'pair', rank, dealer: dealerValue, move: basicStrategyDatabase.pairs[rank][dealerValue] || 'H' });
    });
  });

  return catalog;
}

const STRATEGY_CATALOG = buildStrategyCatalog();
const STRATEGY_CATALOG_BY_ID = Object.fromEntries(STRATEGY_CATALOG.map((entry) => [entry.id, entry]));

function recommendBasicStrategy(hand, dealerUpCard) {
  if (!dealerUpCard) return 'H';

  if (canSplit(hand)) {
    return pairStrategy(hand, dealerUpCard);
  }

  const total = scoreHand(hand);
  if (hasSoftTotal(hand)) {
    return softStrategy(total, dealerUpCard.value);
  }

  if (hand.length === 2 && total === 16 && dealerUpCard.value >= 9 && dealerUpCard.value <= 11) return 'R';
  if (hand.length === 2 && total === 15 && dealerUpCard.value === 10) return 'R';

  return hardStrategy(total, dealerUpCard.value);
}

function pairStrategy(hand, dealerUpCard) {
  const rank = hand[0].rank;
  const dealerValue = dealerUpCard.value;
  const normalizedRank = ['J', 'Q', 'K'].includes(rank) ? '10' : rank;
  const table = basicStrategyDatabase.pairs[normalizedRank] || basicStrategyDatabase.pairs[rank];

  if (!table) return 'H';
  const dealerKey = dealerValue === 11 ? 11 : dealerValue;
  return table[dealerKey] || 'H';
}

function softStrategy(total, dealerValue) {
  const table = basicStrategyDatabase.soft[total];
  if (!table) return 'H';
  const dealerKey = dealerValue === 11 ? 11 : dealerValue;
  return table[dealerKey] || 'H';
}

function hardStrategy(total, dealerValue) {
  const table = basicStrategyDatabase.hard[total];
  if (!table) return 'H';
  const dealerKey = dealerValue === 11 ? 11 : dealerValue;
  return table[dealerKey] || 'H';
}

function describeAction(code) {
  const map = {
    H: 'hit',
    S: 'stand',
    D: 'double',
    P: 'split',
    R: 'surrender'
  };
  return map[code] || 'hit';
}

function choosePreset() {
  showModal('Preset Selection', 'Choose a preset:', ['Training', 'True Game', 'Custom', 'Back to main menu'], (choice) => {
    if (choice === -1) return;
    if (choice === 3) {
      renderScreen('menu');
      return;
    }

    if (choice === 0) {
      state.settings = { ...state.settings, showRunningCount: true, showDecksRemaining: true, showTrueCount: true, surrenderEnabled: true, insuranceEnabled: true, trainingMode: true, showHandTotals: true, decksInShoe: 6 };
      state.presetName = 'Training';
    } else if (choice === 1) {
      state.settings = { ...state.settings, showRunningCount: false, showDecksRemaining: true, showTrueCount: false, surrenderEnabled: true, insuranceEnabled: true, trainingMode: false, showHandTotals: false, decksInShoe: 6 };
      state.presetName = 'True Game';
    } else if (choice === 2) {
      askCustomPreset();
      return;
    }

    state.shoe = createShoe(state.settings.decksInShoe);
    state.countingState.runningCount = 0;
    state.countingState.decksRemaining = state.shoe.length / 52;
    state.countingState.trueCount = 0;
    renderScreen('blackjack');
    renderBetPanel();
    updateHud();
    appendLog(`Preset set: ${state.presetName}`);
  });
}

function askCustomPreset() {
  elements.modalTitle.textContent = 'Custom Settings';
  elements.modalMessage.textContent = 'Choose the options you want for this preset:';
  elements.modalActions.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'custom-settings-list';

  const toggles = [
    { label: 'Show running count', key: 'showRunningCount', value: state.settings.showRunningCount },
    { label: 'Show decks remaining', key: 'showDecksRemaining', value: state.settings.showDecksRemaining },
    { label: 'Show true count', key: 'showTrueCount', value: state.settings.showTrueCount },
    { label: 'Enable surrender', key: 'surrenderEnabled', value: state.settings.surrenderEnabled },
    { label: 'Enable insurance', key: 'insuranceEnabled', value: state.settings.insuranceEnabled },
    { label: 'mistake correction', key: 'trainingMode', value: state.settings.trainingMode },
    { label: 'show hand value', key: 'showHandTotals', value: state.settings.showHandTotals }
  ];

  const settingState = {};

  toggles.forEach(({ label, key, value }) => {
    const row = document.createElement('label');
    row.className = 'custom-setting-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = value;
    settingState[key] = value;
    checkbox.addEventListener('change', () => {
      settingState[key] = checkbox.checked;
    });

    const text = document.createElement('span');
    text.textContent = label;

    row.appendChild(checkbox);
    row.appendChild(text);
    list.appendChild(row);
  });

  const deckRow = document.createElement('label');
  deckRow.className = 'custom-setting-item deck-setting';

  const deckLabel = document.createElement('span');
  deckLabel.textContent = 'Decks in the shoe:';

  const deckSelect = document.createElement('select');
  ['2', '3', '4', '5', '6', '7', '8'].forEach((deckCount) => {
    const option = document.createElement('option');
    option.value = deckCount;
    option.textContent = deckCount;
    if (Number(deckCount) === (state.settings.decksInShoe || 6)) {
      option.selected = true;
    }
    deckSelect.appendChild(option);
  });

  deckRow.appendChild(deckLabel);
  deckRow.appendChild(deckSelect);
  list.appendChild(deckRow);

  const applyButton = document.createElement('button');
  applyButton.textContent = 'Apply';
  applyButton.addEventListener('click', () => {
    hideModal();
    const deckCount = Number(deckSelect.value || 6);

    state.settings = {
      showRunningCount: !!settingState.showRunningCount,
      showDecksRemaining: !!settingState.showDecksRemaining,
      showTrueCount: !!settingState.showTrueCount,
      surrenderEnabled: !!settingState.surrenderEnabled,
      insuranceEnabled: !!settingState.insuranceEnabled,
      trainingMode: !!settingState.trainingMode,
      showHandTotals: !!settingState.showHandTotals,
      decksInShoe: deckCount
    };

    state.presetName = 'Custom';
    state.shoe = createShoe(state.settings.decksInShoe);
    state.countingState.runningCount = 0;
    state.countingState.decksRemaining = state.shoe.length / 52;
    state.countingState.trueCount = 0;
    renderScreen('blackjack');
    renderBetPanel();
    updateHud();
    appendLog(`Preset set: ${state.presetName}`);
  });

  elements.modalActions.appendChild(list);
  elements.modalActions.appendChild(applyButton);
  showModalOverlay();
}

function randomRank() {
  return ranks[Math.floor(Math.random() * ranks.length)];
}

const MISTAKES_STORAGE_KEY = 'blackjackTerminusMistakes';

function loadMistakesFromStorage() {
  try {
    const raw = localStorage.getItem(MISTAKES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => STRATEGY_CATALOG_BY_ID[id]) : [];
  } catch (error) {
    return [];
  }
}

function persistMistakes() {
  try {
    localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(state.strategyState.mistakes));
  } catch (error) {
    // localStorage may be unavailable; the mistakes bank simply won't persist across reloads.
  }
}

function addMistake(id) {
  if (!state.strategyState.mistakes.includes(id)) {
    state.strategyState.mistakes.push(id);
    persistMistakes();
  }
  updateMistakesBadge();
}

function removeMistake(id) {
  state.strategyState.mistakes = state.strategyState.mistakes.filter((mistakeId) => mistakeId !== id);
  persistMistakes();
  updateMistakesBadge();
  if (state.strategyState.view === 'mistakesList') renderMistakesList();
}

function updateMistakesBadge() {
  if (elements.mistakesCountBadge) {
    elements.mistakesCountBadge.textContent = state.strategyState.mistakes.length;
  }
}

function randomSuit() {
  return suits[Math.floor(Math.random() * suits.length)];
}

function pickTwoDifferentSuits() {
  const first = randomSuit();
  const remaining = suits.filter((suit) => suit !== first);
  const second = remaining[Math.floor(Math.random() * remaining.length)];
  return Math.random() < 0.5 ? [first, second] : [second, first];
}

function rankLabelForValue(value, avoidLabel) {
  if (value === 10) {
    const options = ['10', 'J', 'Q', 'K'].filter((rank) => rank !== avoidLabel);
    return options[Math.floor(Math.random() * options.length)];
  }
  return String(value);
}

function buildComboHand(entry) {
  const dealerValue = entry.dealer;
  const dealerRank = dealerValue === 11 ? 'A' : rankLabelForValue(dealerValue);
  const dealerCard = createCard(dealerRank, randomSuit());

  let playerCards;

  if (entry.kind === 'pair') {
    const [suitA, suitB] = pickTwoDifferentSuits();
    const rank = entry.rank === '10' ? PAIR_TEN_RANKS[Math.floor(Math.random() * PAIR_TEN_RANKS.length)] : entry.rank;
    playerCards = [createCard(rank, suitA), createCard(rank, suitB)];
  } else if (entry.kind === 'soft') {
    const otherValue = entry.total - 11;
    const otherRank = String(otherValue);
    const [suitA, suitB] = pickTwoDifferentSuits();
    const cards = [createCard('A', suitA), createCard(otherRank, suitB)];
    playerCards = Math.random() < 0.5 ? cards : [cards[1], cards[0]];
  } else {
    const total = entry.total;
    let r1Value = null;
    let r2Value = null;
    for (let v = 2; v <= 9; v++) {
      const other = total - v;
      if (other >= 2 && other <= 10 && other !== v) {
        r1Value = v;
        r2Value = other;
        break;
      }
    }
    if (r1Value === null) {
      r1Value = total / 2;
      r2Value = total / 2;
    }
    const rank1 = rankLabelForValue(r1Value);
    const rank2 = r1Value === r2Value ? rankLabelForValue(r2Value, rank1) : rankLabelForValue(r2Value);
    const [suitA, suitB] = pickTwoDifferentSuits();
    const cards = [createCard(rank1, suitA), createCard(rank2, suitB)];
    playerCards = Math.random() < 0.5 ? cards : [cards[1], cards[0]];
  }

  return { dealerCard, playerCards };
}

function dealerLabelForValue(value) {
  return value === 11 ? 'A' : String(value);
}

function describeComboLabel(entry) {
  if (entry.kind === 'pair') {
    const label = entry.rank === '10' ? '10-value cards' : `${entry.rank}s`;
    return `Pair of ${label} vs dealer ${dealerLabelForValue(entry.dealer)}`;
  }
  if (entry.kind === 'soft') {
    return `Soft ${entry.total} vs dealer ${dealerLabelForValue(entry.dealer)}`;
  }
  return `Hard ${entry.total} vs dealer ${dealerLabelForValue(entry.dealer)}`;
}

function pickNextComboId() {
  const pool = state.strategyState.pool;
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const currentId = state.strategyState.currentEntry ? state.strategyState.currentEntry.id : null;
  let index;
  do {
    index = Math.floor(Math.random() * pool.length);
  } while (pool[index] === currentId && pool.length > 1);
  return pool[index];
}

function removeFromPool(id) {
  const index = state.strategyState.pool.indexOf(id);
  if (index >= 0) state.strategyState.pool.splice(index, 1);
  updateStrategyProgress();
}

function startNewPracticePool() {
  state.strategyState.view = 'practice';
  state.strategyState.pool = STRATEGY_CATALOG.map((entry) => entry.id);
  shuffle(state.strategyState.pool);
  state.strategyState.sessionTotal = STRATEGY_CATALOG.length;
  state.strategyState.currentEntry = null;
  elements.strategyPlayArea.classList.remove('hidden');
  drawNextStrategyCombo();
}

function startMistakesPracticeSession() {
  if (state.strategyState.mistakes.length === 0) return;
  state.strategyState.view = 'mistakesPractice';
  state.strategyState.pool = [...state.strategyState.mistakes];
  shuffle(state.strategyState.pool);
  state.strategyState.sessionTotal = state.strategyState.pool.length;
  state.strategyState.currentEntry = null;

  elements.strategyMistakesPanel.classList.add('hidden');
  elements.strategyPlayArea.classList.remove('hidden');
  elements.strategyActionGrid.classList.remove('hidden');
  elements.strategyFeedback.classList.remove('hidden');
  elements.strategyProgressRow.classList.remove('hidden');
  elements.strategyBackToListBtn.classList.remove('hidden');
  drawNextStrategyCombo();
}

function drawNextStrategyCombo() {
  elements.strategyNextHandBtn.classList.add('hidden');
  const nextId = pickNextComboId();

  if (!nextId) {
    renderStrategyCompletion();
    return;
  }

  const entry = STRATEGY_CATALOG_BY_ID[nextId];
  const { dealerCard, playerCards } = buildComboHand(entry);
  state.strategyState.currentEntry = entry;
  state.strategyState.currentHand = playerCards;
  state.strategyState.currentDealerCard = dealerCard;
  state.strategyState.answered = false;
  renderStrategyCombo();
}

function renderStrategyCombo() {
  elements.strategyPlayArea.classList.remove('hidden');
  renderHand(elements.strategyDealerHand, [state.strategyState.currentDealerCard], false);
  renderHand(elements.strategyPlayerHand, state.strategyState.currentHand, false);
  elements.strategyHandTotal.textContent = scoreHand(state.strategyState.currentHand);
  elements.strategyFeedback.textContent = 'Choose the best move for this hand.';
  elements.strategyFeedback.className = 'strategy-feedback';
  renderStrategyActionButtons();
  updateStrategyProgress();
}

function renderStrategyActionButtons() {
  const hand = state.strategyState.currentHand;
  const dealerCard = state.strategyState.currentDealerCard;
  const buttons = [
    { code: 'H', label: 'Hit', cls: 'hit' },
    { code: 'S', label: 'Stand', cls: 'stand' },
    { code: 'D', label: 'Double', cls: 'double' }
  ];

  if (canSplit(hand)) buttons.push({ code: 'P', label: 'Split', cls: 'split' });
  if (state.settings.surrenderEnabled) buttons.push({ code: 'R', label: 'Surrender', cls: 'surrender' });

  elements.strategyActionGrid.innerHTML = buttons
    .map((button) => `<button type="button" class="action-button ${button.cls}" data-strategy-action="${button.code}">${button.label}</button>`)
    .join('');
}

function markStrategyButtons(chosenCode, correctCode) {
  elements.strategyActionGrid.querySelectorAll('[data-strategy-action]').forEach((button) => {
    button.disabled = true;
    const code = button.dataset.strategyAction;
    if (code === correctCode) button.classList.add('correct-answer');
    if (code === chosenCode && code !== correctCode) button.classList.add('wrong-answer');
  });
}

function handleStrategyAnswer(chosenCode) {
  if (state.strategyState.answered) return;
  state.strategyState.answered = true;

  const entry = state.strategyState.currentEntry;
  const hand = state.strategyState.currentHand;
  const dealerCard = state.strategyState.currentDealerCard;

  let correctCode = recommendBasicStrategy(hand, dealerCard);
  if (correctCode === 'R' && !state.settings.surrenderEnabled) {
    correctCode = 'H';
  }

  const isInsuranceChoice = chosenCode === 'I';
  const isCorrect = !isInsuranceChoice && chosenCode === correctCode;

  markStrategyButtons(chosenCode, correctCode);

  if (isCorrect) {
    handleStrategyCorrect(entry);
  } else {
    handleStrategyIncorrect(entry, chosenCode, correctCode, isInsuranceChoice);
  }
}

function handleStrategyCorrect(entry) {
  elements.strategyFeedback.textContent = 'Correct! Well played.';
  elements.strategyFeedback.className = 'strategy-feedback correct';
  removeFromPool(entry.id);

  if (state.strategyState.view === 'mistakesPractice') {
    showModal(
      'Nice work!',
      'Remove this hand from your Mistakes Bank, or keep it there to practice some more?',
      ['Remove from Mistakes', 'Keep in Mistakes'],
      (choice) => {
        if (choice === 0) removeMistake(entry.id);
        drawNextStrategyCombo();
      }
    );
  } else {
    elements.strategyNextHandBtn.classList.remove('hidden');
  }
}

function handleStrategyIncorrect(entry, chosenCode, correctCode, isInsuranceChoice) {
  addMistake(entry.id);
  const correctLabel = describeAction(correctCode);

  elements.strategyFeedback.textContent = isInsuranceChoice
    ? `Insurance isn't recommended by basic strategy. The best move here is to ${correctLabel}.`
    : `Not quite — the best move here is to ${correctLabel}.`;
  elements.strategyFeedback.className = 'strategy-feedback incorrect';
  elements.strategyNextHandBtn.classList.remove('hidden');
}

function updateStrategyProgress() {
  const total = state.strategyState.sessionTotal || 1;
  const remaining = state.strategyState.pool.length;
  const done = total - remaining;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  elements.strategyProgressFill.style.width = `${pct}%`;
  elements.strategyProgressLabel.textContent = state.strategyState.view === 'mistakesPractice'
    ? `${remaining} / ${total} mistakes remaining`
    : `${remaining} / ${total} combinations remaining`;
}

function renderStrategyCompletion() {
  state.strategyState.currentEntry = null;
  elements.strategyPlayArea.classList.add('hidden');
  elements.strategyActionGrid.innerHTML = '';
  elements.strategyNextHandBtn.classList.add('hidden');
  updateStrategyProgress();

  const isMistakes = state.strategyState.view === 'mistakesPractice';
  elements.strategyFeedback.className = 'strategy-feedback complete';
  elements.strategyFeedback.innerHTML = isMistakes
    ? `You've cleared every hand in this Mistakes session!<br /><button type="button" class="menu-btn primary strategy-complete-btn" id="strategyBackToListAfterBtn">Back to Mistakes List</button>`
    : `You've practiced every hand and dealer combination!<br /><button type="button" class="menu-btn primary strategy-complete-btn" id="strategyPracticeAgainBtn">Practice Again</button>`;

  const backBtn = document.getElementById('strategyBackToListAfterBtn');
  if (backBtn) backBtn.addEventListener('click', showMistakesListView);

  const againBtn = document.getElementById('strategyPracticeAgainBtn');
  if (againBtn) againBtn.addEventListener('click', startNewPracticePool);
}

function showPracticeView() {
  state.strategyState.view = 'practice';
  elements.strategyTabPractice.classList.add('active');
  elements.strategyTabMistakes.classList.remove('active');
  elements.strategyMistakesPanel.classList.add('hidden');
  elements.strategyPlayArea.classList.remove('hidden');
  elements.strategyActionGrid.classList.remove('hidden');
  elements.strategyFeedback.classList.remove('hidden');
  elements.strategyProgressRow.classList.remove('hidden');
  elements.strategyBackToListBtn.classList.add('hidden');

  if (!state.strategyState.currentEntry && state.strategyState.pool.length === 0) {
    startNewPracticePool();
  } else if (state.strategyState.currentEntry) {
    renderStrategyCombo();
  } else {
    renderStrategyCompletion();
  }
}

function showMistakesListView() {
  state.strategyState.view = 'mistakesList';
  elements.strategyTabMistakes.classList.add('active');
  elements.strategyTabPractice.classList.remove('active');
  elements.strategyPlayArea.classList.add('hidden');
  elements.strategyActionGrid.classList.add('hidden');
  elements.strategyFeedback.classList.add('hidden');
  elements.strategyNextHandBtn.classList.add('hidden');
  elements.strategyProgressRow.classList.add('hidden');
  elements.strategyBackToListBtn.classList.add('hidden');
  elements.strategyMistakesPanel.classList.remove('hidden');
  renderMistakesList();
}

function renderMistakesList() {
  const ids = state.strategyState.mistakes;
  elements.strategyMistakesEmpty.classList.toggle('hidden', ids.length > 0);
  elements.strategyPracticeMistakesBtn.disabled = ids.length === 0;

  elements.strategyMistakesList.innerHTML = ids
    .map((id) => {
      const entry = STRATEGY_CATALOG_BY_ID[id];
      if (!entry) return '';
      return `
        <div class="mistake-row">
          <div class="mistake-row-label">${describeComboLabel(entry)}</div>
          <button type="button" class="mistake-remove-btn" data-remove-mistake="${id}" title="Remove from Mistakes Bank">✕</button>
        </div>
      `;
    })
    .join('');

  updateMistakesBadge();
}

function bindStrategyTrainerEvents() {
  elements.strategyTabPractice.addEventListener('click', showPracticeView);
  elements.strategyTabMistakes.addEventListener('click', showMistakesListView);
  elements.strategyPracticeMistakesBtn.addEventListener('click', startMistakesPracticeSession);
  elements.strategyBackToListBtn.addEventListener('click', showMistakesListView);

  elements.strategyNextHandBtn.addEventListener('click', () => {
    elements.strategyNextHandBtn.classList.add('hidden');
    drawNextStrategyCombo();
  });

  elements.strategyActionGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-strategy-action]');
    if (!button || state.strategyState.answered) return;
    handleStrategyAnswer(button.dataset.strategyAction);
  });

  elements.strategyMistakesList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-mistake]');
    if (!button) return;
    removeMistake(button.dataset.removeMistake);
  });

  elements.strategySurrenderToggle.addEventListener('change', (event) => {
    state.settings.surrenderEnabled = event.target.checked;
    if (state.strategyState.currentEntry && !state.strategyState.answered) renderStrategyActionButtons();
  });
}

function syncSharedStrategyToggles() {
  if (elements.strategySurrenderToggle) elements.strategySurrenderToggle.checked = state.settings.surrenderEnabled;
  if (elements.quizSurrenderToggle) elements.quizSurrenderToggle.checked = state.settings.surrenderEnabled;
  if (elements.chartSurrenderToggle) elements.chartSurrenderToggle.checked = state.settings.surrenderEnabled;
}

function sampleEntries(entries, count) {
  const copy = [...entries];
  shuffle(copy);
  return copy.slice(0, count);
}

/* ---------------------------------------------------------------------- */
/* Questionnaire minigame                                                  */
/* ---------------------------------------------------------------------- */

function buildRowActionQuestions(kind, keys, table) {
  const questions = [];
  const dealerValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  keys.forEach((key) => {
    const row = table[key];
    const groups = {};
    dealerValues.forEach((dealerValue) => {
      const code = row[dealerValue];
      if (!groups[code]) groups[code] = [];
      groups[code].push(dealerValue);
    });

    const distinctActions = Object.keys(groups);
    if (distinctActions.length < 2) return; // uniform rows aren't interesting as a "select all" question

    const rowLabel = kind === 'pair'
      ? (key === '10' ? 'a pair of 10-value cards' : `a pair of ${key}s`)
      : kind === 'soft'
        ? `a soft ${key}`
        : `a hard ${key}`;

    distinctActions.forEach((code) => {
      const dealers = groups[code];
      if (dealers.length < 2 || dealers.length > 8) return; // skip near-trivial 1-of-10 or 9-of-10 splits

      questions.push({
        id: `row-${kind}-${key}-${code}`,
        type: 'all',
        requiresSurrender: code === 'R',
        prompt: `With ${rowLabel}, against which dealer upcards should you ${describeAction(code)}? Select all that apply.`,
        options: dealerValues.map((dealerValue) => ({ id: `d-${dealerValue}`, label: dealerLabelForValue(dealerValue) })),
        correctIds: dealers.map((dealerValue) => `d-${dealerValue}`)
      });
    });
  });

  return questions;
}

function buildDealerActionQuestions() {
  const questions = [];
  const dealerValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const actionConcepts = [
    { code: 'D', kind: null, label: 'double' },
    { code: 'P', kind: 'pair', label: 'split' }
  ];

  dealerValues.forEach((dealerValue) => {
    actionConcepts.forEach(({ code, kind, label }) => {
      const candidates = STRATEGY_CATALOG.filter((e) => e.dealer === dealerValue && (kind ? e.kind === kind : e.kind !== 'pair'));
      const correctOnes = candidates.filter((e) => e.move === code);
      if (correctOnes.length < 2) return;
      const wrongPool = candidates.filter((e) => e.move !== code);
      if (wrongPool.length === 0) return;

      const correctSample = sampleEntries(correctOnes, Math.min(4, correctOnes.length));
      const wrongSample = sampleEntries(wrongPool, Math.min(4, wrongPool.length));
      const options = [...correctSample, ...wrongSample];
      shuffle(options);

      questions.push({
        id: `dealer-${label}-${dealerValue}`,
        type: 'all',
        requiresSurrender: false,
        prompt: `Dealer shows a ${dealerLabelForValue(dealerValue)}. Select all hands below where you should ${label}.`,
        options: options.map((e) => ({ id: e.id, label: describeComboLabel(e).replace(` vs dealer ${dealerLabelForValue(dealerValue)}`, '') })),
        correctIds: correctSample.map((e) => e.id)
      });
    });
  });

  return questions;
}

function buildConceptChooseAllQuestion(id, prompt, correctList, allPool, labelFn) {
  if (correctList.length === 0) return null;
  const decoyPool = allPool.filter((value) => !correctList.includes(value));
  const decoys = sampleEntries(decoyPool, Math.min(4, decoyPool.length));
  const options = [...correctList, ...decoys];
  shuffle(options);

  return {
    id,
    type: 'all',
    requiresSurrender: false,
    prompt,
    options: options.map((value) => ({ id: `${id}-${value}`, label: labelFn(value) })),
    correctIds: correctList.map((value) => `${id}-${value}`)
  };
}

function buildDynamicTrueFalseQuestion(id, prompt, isActuallyTrue) {
  return {
    id,
    type: 'tf',
    requiresSurrender: false,
    prompt,
    options: [{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }],
    correctIds: [isActuallyTrue ? 'true' : 'false']
  };
}

function buildConceptQuestions() {
  const questions = [];
  const dealerValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const pairRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const hardTotals = Object.keys(basicStrategyDatabase.hard).map(Number).filter((t) => t <= 20);

  const pairLabel = (rank) => (rank === '10' ? 'Pair of 10-value cards' : `Pair of ${rank}s`);
  const alwaysSplit = pairRanks.filter((rank) => dealerValues.every((d) => basicStrategyDatabase.pairs[rank][d] === 'P'));
  const neverSplit = pairRanks.filter((rank) => dealerValues.every((d) => basicStrategyDatabase.pairs[rank][d] !== 'P'));
  const alwaysStandHard = hardTotals.filter((t) => dealerValues.every((d) => basicStrategyDatabase.hard[t][d] === 'S'));
  const alwaysHitHard = hardTotals.filter((t) => dealerValues.every((d) => basicStrategyDatabase.hard[t][d] === 'H'));

  [
    buildConceptChooseAllQuestion('concept-always-split', 'Select all pairs below that should ALWAYS be split, no matter what the dealer shows.', alwaysSplit, pairRanks, pairLabel),
    buildConceptChooseAllQuestion('concept-never-split', 'Select all pairs below that should NEVER be split, no matter what the dealer shows.', neverSplit, pairRanks, pairLabel),
    buildConceptChooseAllQuestion('concept-always-stand', 'Select all hard totals below that should ALWAYS stand, no matter what the dealer shows.', alwaysStandHard, hardTotals, (t) => `Hard ${t}`),
    buildConceptChooseAllQuestion('concept-always-hit', 'Select all hard totals below that should ALWAYS hit, no matter what the dealer shows.', alwaysHitHard, hardTotals, (t) => `Hard ${t}`)
  ].forEach((q) => { if (q) questions.push(q); });

  const surrenderEntries = STRATEGY_CATALOG.filter((e) => e.move === 'R');
  if (surrenderEntries.length) {
    const decoys = sampleEntries(STRATEGY_CATALOG.filter((e) => e.move !== 'R' && e.kind === 'hard'), Math.min(4, surrenderEntries.length));
    const options = [...surrenderEntries, ...decoys];
    shuffle(options);
    questions.push({
      id: 'concept-surrender',
      type: 'all',
      requiresSurrender: true,
      prompt: 'Select all hands below where Surrender is the correct basic strategy play (assuming surrender is available).',
      options: options.map((e) => ({ id: e.id, label: describeComboLabel(e) })),
      correctIds: surrenderEntries.map((e) => e.id)
    });
  }

  const soft18AlwaysStand = dealerValues.every((d) => basicStrategyDatabase.soft[18][d] === 'S');
  const soft19AlwaysStand = dealerValues.every((d) => basicStrategyDatabase.soft[19][d] === 'S');
  const pair8AlwaysSplit = dealerValues.every((d) => basicStrategyDatabase.pairs['8'][d] === 'P');
  const pair5EverSplit = dealerValues.some((d) => basicStrategyDatabase.pairs['5'][d] === 'P');
  const hard12AlwaysHit = dealerValues.every((d) => basicStrategyDatabase.hard[12][d] === 'H');
  const hard13StandsVs2 = basicStrategyDatabase.hard[13][2] === 'S';

  questions.push(buildDynamicTrueFalseQuestion('concept-tf-soft18', 'True or False: With a soft 18, you should always stand no matter what the dealer shows.', soft18AlwaysStand));
  questions.push(buildDynamicTrueFalseQuestion('concept-tf-soft19', 'True or False: With a soft 19, you should always stand no matter what the dealer shows.', soft19AlwaysStand));
  questions.push(buildDynamicTrueFalseQuestion('concept-tf-pair8', 'True or False: A pair of 8s should always be split, no matter what the dealer shows.', pair8AlwaysSplit));
  questions.push(buildDynamicTrueFalseQuestion('concept-tf-pair5', 'True or False: A pair of 5s should sometimes be split, depending on the dealer\'s upcard.', pair5EverSplit));
  questions.push(buildDynamicTrueFalseQuestion('concept-tf-hard12', 'True or False: With a hard 12, you should always hit no matter what the dealer shows.', hard12AlwaysHit));
  questions.push(buildDynamicTrueFalseQuestion('concept-tf-hard13', 'True or False: With a hard 13, you should stand against a dealer 2.', hard13StandsVs2));

  return questions;
}

function buildQuestionnaireCatalog() {
  const questions = [];
  const hardTotals = Object.keys(basicStrategyDatabase.hard).map(Number).filter((t) => t <= 20);
  const softTotals = Object.keys(basicStrategyDatabase.soft).map(Number).filter((t) => t <= 20);
  const pairRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  buildRowActionQuestions('hard', hardTotals, basicStrategyDatabase.hard).forEach((q) => questions.push(q));
  buildRowActionQuestions('soft', softTotals, basicStrategyDatabase.soft).forEach((q) => questions.push(q));
  buildRowActionQuestions('pair', pairRanks, basicStrategyDatabase.pairs).forEach((q) => questions.push(q));
  buildDealerActionQuestions().forEach((q) => questions.push(q));
  buildConceptQuestions().forEach((q) => questions.push(q));

  return questions;
}

const QUESTIONNAIRE_CATALOG = buildQuestionnaireCatalog();
const QUESTIONNAIRE_CATALOG_BY_ID = Object.fromEntries(QUESTIONNAIRE_CATALOG.map((q) => [q.id, q]));
const QUIZ_MISTAKES_STORAGE_KEY = 'blackjackTerminusQuizMistakes';

function loadQuizMistakesFromStorage() {
  try {
    const raw = localStorage.getItem(QUIZ_MISTAKES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => QUESTIONNAIRE_CATALOG_BY_ID[id]) : [];
  } catch (error) {
    return [];
  }
}

function persistQuizMistakes() {
  try {
    localStorage.setItem(QUIZ_MISTAKES_STORAGE_KEY, JSON.stringify(state.questionnaireState.mistakes));
  } catch (error) {
    // localStorage may be unavailable; the mistakes bank simply won't persist across reloads.
  }
}

function addQuizMistake(id) {
  if (!state.questionnaireState.mistakes.includes(id)) {
    state.questionnaireState.mistakes.push(id);
    persistQuizMistakes();
  }
  updateQuizMistakesBadge();
}

function removeQuizMistake(id) {
  state.questionnaireState.mistakes = state.questionnaireState.mistakes.filter((mistakeId) => mistakeId !== id);
  persistQuizMistakes();
  updateQuizMistakesBadge();
  if (state.questionnaireState.view === 'mistakesList') renderQuizMistakesList();
}

function updateQuizMistakesBadge() {
  if (elements.quizMistakesCountBadge) {
    elements.quizMistakesCountBadge.textContent = state.questionnaireState.mistakes.length;
  }
}

function isQuestionAllowed(question) {
  if (!question) return false;
  if (question.requiresSurrender && !state.settings.surrenderEnabled) return false;
  return true;
}

function getAllowedQuestionIds() {
  return QUESTIONNAIRE_CATALOG.filter(isQuestionAllowed).map((q) => q.id);
}

function pickNextQuizId() {
  const pool = state.questionnaireState.pool;
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const currentId = state.questionnaireState.currentQuestion ? state.questionnaireState.currentQuestion.id : null;
  let index;
  do {
    index = Math.floor(Math.random() * pool.length);
  } while (pool[index] === currentId && pool.length > 1);
  return pool[index];
}

function removeFromQuizPool(id) {
  const index = state.questionnaireState.pool.indexOf(id);
  if (index >= 0) state.questionnaireState.pool.splice(index, 1);
  updateQuizProgress();
}

function startNewQuizPool() {
  state.questionnaireState.view = 'practice';
  state.questionnaireState.pool = getAllowedQuestionIds();
  shuffle(state.questionnaireState.pool);
  state.questionnaireState.sessionTotal = state.questionnaireState.pool.length;
  state.questionnaireState.currentQuestion = null;
  elements.quizPlayArea.classList.remove('hidden');
  drawNextQuizQuestion();
}

function startQuizMistakesPractice() {
  if (state.questionnaireState.mistakes.length === 0) return;
  state.questionnaireState.view = 'mistakesPractice';
  state.questionnaireState.pool = state.questionnaireState.mistakes.filter((id) => isQuestionAllowed(QUESTIONNAIRE_CATALOG_BY_ID[id]));
  shuffle(state.questionnaireState.pool);
  state.questionnaireState.sessionTotal = state.questionnaireState.pool.length;
  state.questionnaireState.currentQuestion = null;

  elements.quizMistakesPanel.classList.add('hidden');
  elements.quizPlayArea.classList.remove('hidden');
  elements.quizFeedback.classList.add('hidden');
  elements.quizProgressRow.classList.remove('hidden');
  elements.quizBackToListBtn.classList.remove('hidden');
  drawNextQuizQuestion();
}

function drawNextQuizQuestion() {
  elements.quizNextBtn.classList.add('hidden');
  elements.quizFeedback.classList.add('hidden');
  const nextId = pickNextQuizId();

  if (!nextId) {
    renderQuizCompletion();
    return;
  }

  const question = QUESTIONNAIRE_CATALOG_BY_ID[nextId];
  state.questionnaireState.currentQuestion = question;
  state.questionnaireState.selected = [];
  state.questionnaireState.answered = false;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  elements.quizPlayArea.classList.remove('hidden');
  const question = state.questionnaireState.currentQuestion;
  const typeLabels = { mc: 'Multiple Choice', tf: 'True or False', all: 'Choose All That Apply' };
  elements.quizTypeTag.textContent = typeLabels[question.type] || 'Question';
  elements.quizPrompt.textContent = question.prompt;

  elements.quizOptions.innerHTML = question.options
    .map((option) => `<button type="button" class="quiz-option" data-quiz-option="${option.id}">${option.label}</button>`)
    .join('');

  elements.quizSubmitBtn.classList.toggle('hidden', question.type !== 'all');
  elements.quizSubmitBtn.disabled = true;
  updateQuizProgress();
}

function correctAnswerSummary(question) {
  return question.options.filter((o) => question.correctIds.includes(o.id)).map((o) => o.label).join(', ');
}

function markQuizOptions(question, selected, correct) {
  elements.quizOptions.querySelectorAll('[data-quiz-option]').forEach((button) => {
    button.disabled = true;
    const optionId = button.dataset.quizOption;
    if (correct.includes(optionId)) button.classList.add('correct-answer');
    if (selected.includes(optionId) && !correct.includes(optionId)) button.classList.add('wrong-answer');
  });
  elements.quizSubmitBtn.disabled = true;
}

function handleQuizAnswer() {
  if (state.questionnaireState.answered) return;
  state.questionnaireState.answered = true;

  const question = state.questionnaireState.currentQuestion;
  const selected = [...state.questionnaireState.selected].sort();
  const correct = [...question.correctIds].sort();
  const isCorrect = selected.length === correct.length && selected.every((id, i) => id === correct[i]);

  markQuizOptions(question, selected, correct);

  if (isCorrect) {
    handleQuizCorrect(question);
  } else {
    handleQuizIncorrect(question, correct);
  }
}

function handleQuizCorrect(question) {
  elements.quizFeedback.textContent = 'Correct! Well played.';
  elements.quizFeedback.className = 'strategy-feedback correct';
  elements.quizFeedback.classList.remove('hidden');
  removeFromQuizPool(question.id);

  if (state.questionnaireState.view === 'mistakesPractice') {
    showModal(
      'Nice work!',
      'Remove this question from your Mistakes Bank, or keep it there to practice some more?',
      ['Remove from Mistakes', 'Keep in Mistakes'],
      (choice) => {
        if (choice === 0) removeQuizMistake(question.id);
        drawNextQuizQuestion();
      }
    );
  } else {
    elements.quizNextBtn.classList.remove('hidden');
  }
}

function handleQuizIncorrect(question, correct) {
  addQuizMistake(question.id);
  elements.quizFeedback.textContent = `Not quite — the correct answer is: ${correctAnswerSummary(question)}.`;
  elements.quizFeedback.className = 'strategy-feedback incorrect';
  elements.quizFeedback.classList.remove('hidden');
  elements.quizNextBtn.classList.remove('hidden');
}

function updateQuizProgress() {
  const total = state.questionnaireState.sessionTotal || 1;
  const remaining = state.questionnaireState.pool.length;
  const done = total - remaining;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  elements.quizProgressFill.style.width = `${pct}%`;
  elements.quizProgressLabel.textContent = state.questionnaireState.view === 'mistakesPractice'
    ? `${remaining} / ${total} mistakes remaining`
    : `${remaining} / ${total} questions remaining`;
}

function renderQuizCompletion() {
  state.questionnaireState.currentQuestion = null;
  elements.quizPlayArea.classList.add('hidden');
  elements.quizNextBtn.classList.add('hidden');
  updateQuizProgress();

  const isMistakes = state.questionnaireState.view === 'mistakesPractice';
  elements.quizFeedback.classList.remove('hidden');
  elements.quizFeedback.className = 'strategy-feedback complete';
  elements.quizFeedback.innerHTML = isMistakes
    ? `You've cleared every question in this Mistakes session!<br /><button type="button" class="menu-btn primary strategy-complete-btn" id="quizBackToListAfterBtn">Back to Mistakes List</button>`
    : `You've answered every question!<br /><button type="button" class="menu-btn primary strategy-complete-btn" id="quizPracticeAgainBtn">Practice Again</button>`;

  const backBtn = document.getElementById('quizBackToListAfterBtn');
  if (backBtn) backBtn.addEventListener('click', showQuizMistakesListView);

  const againBtn = document.getElementById('quizPracticeAgainBtn');
  if (againBtn) againBtn.addEventListener('click', startNewQuizPool);
}

function showQuizPracticeView() {
  state.questionnaireState.view = 'practice';
  elements.quizTabPractice.classList.add('active');
  elements.quizTabMistakes.classList.remove('active');
  elements.quizMistakesPanel.classList.add('hidden');
  elements.quizPlayArea.classList.remove('hidden');
  elements.quizFeedback.classList.add('hidden');
  elements.quizProgressRow.classList.remove('hidden');
  elements.quizBackToListBtn.classList.add('hidden');

  if (!state.questionnaireState.currentQuestion && state.questionnaireState.pool.length === 0) {
    startNewQuizPool();
  } else if (state.questionnaireState.currentQuestion) {
    renderQuizQuestion();
  } else {
    renderQuizCompletion();
  }
}

function showQuizMistakesListView() {
  state.questionnaireState.view = 'mistakesList';
  elements.quizTabMistakes.classList.add('active');
  elements.quizTabPractice.classList.remove('active');
  elements.quizPlayArea.classList.add('hidden');
  elements.quizFeedback.classList.add('hidden');
  elements.quizNextBtn.classList.add('hidden');
  elements.quizProgressRow.classList.add('hidden');
  elements.quizBackToListBtn.classList.add('hidden');
  elements.quizMistakesPanel.classList.remove('hidden');
  renderQuizMistakesList();
}

function renderQuizMistakesList() {
  const ids = state.questionnaireState.mistakes;
  elements.quizMistakesEmpty.classList.toggle('hidden', ids.length > 0);
  elements.quizPracticeMistakesBtn.disabled = ids.length === 0;

  elements.quizMistakesList.innerHTML = ids
    .map((id) => {
      const question = QUESTIONNAIRE_CATALOG_BY_ID[id];
      if (!question) return '';
      return `
        <div class="mistake-row">
          <div class="mistake-row-label">${question.prompt}</div>
          <button type="button" class="mistake-remove-btn" data-remove-quiz-mistake="${id}" title="Remove from Mistakes Bank">✕</button>
        </div>
      `;
    })
    .join('');

  updateQuizMistakesBadge();
}

function renderQuestionnaireScreen() {
  state.questionnaireState.mistakes = loadQuizMistakesFromStorage();
  updateQuizMistakesBadge();
  elements.quizSurrenderToggle.checked = state.settings.surrenderEnabled;
  showQuizPracticeView();
}

function bindQuestionnaireEvents() {
  elements.quizTabPractice.addEventListener('click', showQuizPracticeView);
  elements.quizTabMistakes.addEventListener('click', showQuizMistakesListView);
  elements.quizPracticeMistakesBtn.addEventListener('click', startQuizMistakesPractice);
  elements.quizBackToListBtn.addEventListener('click', showQuizMistakesListView);

  elements.quizNextBtn.addEventListener('click', () => {
    elements.quizNextBtn.classList.add('hidden');
    drawNextQuizQuestion();
  });

  elements.quizOptions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quiz-option]');
    if (!button || state.questionnaireState.answered) return;
    const question = state.questionnaireState.currentQuestion;

    if (question.type === 'all') {
      button.classList.toggle('selected');
      const selected = Array.from(elements.quizOptions.querySelectorAll('.quiz-option.selected')).map((el) => el.dataset.quizOption);
      state.questionnaireState.selected = selected;
      elements.quizSubmitBtn.disabled = selected.length === 0;
      return;
    }

    state.questionnaireState.selected = [button.dataset.quizOption];
    handleQuizAnswer();
  });

  elements.quizSubmitBtn.addEventListener('click', () => {
    if (state.questionnaireState.answered || state.questionnaireState.selected.length === 0) return;
    handleQuizAnswer();
  });

  elements.quizMistakesList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-quiz-mistake]');
    if (!button) return;
    removeQuizMistake(button.dataset.removeQuizMistake);
  });

  elements.quizSurrenderToggle.addEventListener('change', (event) => {
    state.settings.surrenderEnabled = event.target.checked;
    syncSharedStrategyToggles();
  });
}

/* ---------------------------------------------------------------------- */
/* Charts minigame                                                         */
/* ---------------------------------------------------------------------- */

const CHART_DEALER_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CHART_DEALER_HEADERS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

function chartCycleForKind(kind) {
  if (kind === 'hard') return ['H', 'S', 'D', ...(state.settings.surrenderEnabled ? ['R'] : [])];
  if (kind === 'soft') return ['H', 'S', 'D'];
  return ['P', 'H', 'S', 'D'];
}

function chartCellLabel(code) {
  const labels = { H: 'H', S: 'S', D: 'D', P: 'P', R: 'R' };
  return labels[code] || '?';
}

function buildChartRows(kind, keys) {
  return keys.map((key) => ({
    key,
    label: kind === 'pair' ? (key === '10' ? '10-value' : `${key}s`) : String(key),
    cells: CHART_DEALER_VALUES.map((dealer) => `${kind}-${key}-${dealer}`)
  }));
}

function renderChartLegend() {
  const items = ['Type: H = Hit', 'S = Stand', 'D = Double', 'P = Split'];
  if (state.settings.surrenderEnabled) items.push('R = Surrender');
  elements.chartLegend.innerHTML = items.map((item) => `<span>${item}</span>`).join('');
}

function renderChartTables() {
  const hardKeys = Object.keys(basicStrategyDatabase.hard).map(Number).filter((t) => t >= 8 && t <= 20).sort((a, b) => a - b);
  const softKeys = Object.keys(basicStrategyDatabase.soft).map(Number).filter((t) => t <= 20).sort((a, b) => a - b);
  const pairKeys = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  const sections = [
    { label: 'Hard totals', kind: 'hard', rows: buildChartRows('hard', hardKeys) },
    { label: 'Soft totals', kind: 'soft', rows: buildChartRows('soft', softKeys) },
    { label: 'Pairs', kind: 'pair', rows: buildChartRows('pair', pairKeys) }
  ];

  elements.chartTablesContainer.innerHTML = sections.map((section) => `
    <h3 class="chart-section-title">${section.label}</h3>
    <div class="chart-table-scroll">
      <table class="chart-table">
        <thead><tr><th>Hand</th>${CHART_DEALER_HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${section.rows.map((row) => `
            <tr>
              <th>${row.label}</th>
              ${row.cells.map((key) => `<td><input type="text" class="chart-cell" data-chart-key="${key}" data-chart-kind="${section.kind}" maxlength="1" autocomplete="off" spellcheck="false" /></td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

function getChartCellInputs() {
  return Array.from(elements.chartTablesContainer.querySelectorAll('[data-chart-key]'));
}

function focusNextChartCell(currentInput) {
  const inputs = getChartCellInputs();
  const idx = inputs.indexOf(currentInput);
  if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
}

function focusPreviousChartCell(currentInput) {
  const inputs = getChartCellInputs();
  const idx = inputs.indexOf(currentInput);
  if (idx > 0) inputs[idx - 1].focus();
}

function resetChart() {
  state.chartState.selections = {};
  state.chartState.submitted = false;
  elements.chartScoreBanner.classList.add('hidden');
  elements.chartResetBtn.classList.add('hidden');
  elements.chartSubmitBtn.classList.remove('hidden');
  renderChartTables();
}

function submitChart() {
  const hardKeys = Object.keys(basicStrategyDatabase.hard).map(Number).filter((t) => t >= 8 && t <= 20);
  const softKeys = Object.keys(basicStrategyDatabase.soft).map(Number).filter((t) => t <= 20);
  const pairKeys = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  let total = 0;
  let correctCount = 0;

  function gradeCell(key, correctCode) {
    total += 1;
    const input = elements.chartTablesContainer.querySelector(`[data-chart-key="${key}"]`);
    if (!input) return;
    const chosen = state.chartState.selections[key];
    const isCorrect = chosen === correctCode;
    if (isCorrect) correctCount += 1;
    input.classList.add(isCorrect ? 'correct-answer' : 'wrong-answer');
    if (!isCorrect) {
      input.removeAttribute('maxlength');
      input.value = `${chosen ? chartCellLabel(chosen) : '?'}→${chartCellLabel(correctCode)}`;
    }
    input.disabled = true;
  }

  hardKeys.forEach((totalValue) => {
    CHART_DEALER_VALUES.forEach((dealer) => {
      let correctCode = basicStrategyDatabase.hard[totalValue][dealer] || 'H';
      if (correctCode === 'R' && !state.settings.surrenderEnabled) correctCode = 'H';
      gradeCell(`hard-${totalValue}-${dealer}`, correctCode);
    });
  });

  softKeys.forEach((totalValue) => {
    CHART_DEALER_VALUES.forEach((dealer) => {
      const correctCode = basicStrategyDatabase.soft[totalValue][dealer] || 'H';
      gradeCell(`soft-${totalValue}-${dealer}`, correctCode);
    });
  });

  pairKeys.forEach((rank) => {
    CHART_DEALER_VALUES.forEach((dealer) => {
      const correctCode = basicStrategyDatabase.pairs[rank][dealer] || 'H';
      gradeCell(`pair-${rank}-${dealer}`, correctCode);
    });
  });

  state.chartState.submitted = true;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  elements.chartScoreBanner.textContent = `Score: ${correctCount} / ${total} (${pct}%)`;
  elements.chartScoreBanner.classList.remove('hidden');
  elements.chartSubmitBtn.classList.add('hidden');
  elements.chartResetBtn.classList.remove('hidden');
}

function renderChartsScreen() {
  elements.chartSurrenderToggle.checked = state.settings.surrenderEnabled;
  renderChartLegend();
  resetChart();
}

function bindChartsEvents() {
  elements.chartTablesContainer.addEventListener('input', (event) => {
    const input = event.target.closest('[data-chart-key]');
    if (!input || state.chartState.submitted) return;
    const key = input.dataset.chartKey;
    const kind = input.dataset.chartKind;
    const allowed = chartCycleForKind(kind);
    const letter = input.value.trim().toUpperCase().slice(-1);

    if (!letter) {
      delete state.chartState.selections[key];
      input.value = '';
      input.classList.remove('filled');
      return;
    }

    if (!allowed.includes(letter)) {
      input.value = '';
      input.classList.add('invalid');
      setTimeout(() => input.classList.remove('invalid'), 220);
      return;
    }

    state.chartState.selections[key] = letter;
    input.value = letter;
    input.classList.add('filled');
    focusNextChartCell(input);
  });

  elements.chartTablesContainer.addEventListener('keydown', (event) => {
    const input = event.target.closest('[data-chart-key]');
    if (!input || state.chartState.submitted) return;
    if (event.key === 'Backspace' && input.value === '') {
      event.preventDefault();
      focusPreviousChartCell(input);
    }
  });

  elements.chartTablesContainer.addEventListener('focusin', (event) => {
    const input = event.target.closest('[data-chart-key]');
    if (input) input.select();
  });

  elements.chartSubmitBtn.addEventListener('click', submitChart);
  elements.chartResetBtn.addEventListener('click', resetChart);

  elements.chartSurrenderToggle.addEventListener('change', (event) => {
    state.settings.surrenderEnabled = event.target.checked;
    syncSharedStrategyToggles();
    renderChartLegend();
    resetChart();
  });
}

function renderRulesScreen() {
  const content = document.getElementById('rulesContent');
  if (!content) return;

  // Rows are generated directly from basicStrategyDatabase (the same table the
  // trainer/game use for grading) so this reference chart can never drift out
  // of sync with actual gameplay behavior.
  const dealerValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  function buildRows(table, order) {
    const rawRows = order.map((key) => [String(key), ...dealerValues.map((d) => table[key][d] || 'H')]);

    const collapsed = [];
    let i = 0;
    while (i < rawRows.length) {
      let j = i;
      while (j + 1 < rawRows.length && rawRows[j + 1].slice(1).join(',') === rawRows[i].slice(1).join(',')) {
        j++;
      }
      const label = i === j ? rawRows[i][0] : `${rawRows[i][0]}-${rawRows[j][0]}`;
      collapsed.push([label, ...rawRows[i].slice(1)]);
      i = j + 1;
    }
    return collapsed;
  }

  const hardOrder = Object.keys(basicStrategyDatabase.hard).map(Number).sort((a, b) => a - b);
  const softOrder = Object.keys(basicStrategyDatabase.soft).map(Number).sort((a, b) => a - b);
  const pairOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const strategyTables = [
    { label: 'Hard totals', rows: buildRows(basicStrategyDatabase.hard, hardOrder) },
    { label: 'Soft totals', rows: buildRows(basicStrategyDatabase.soft, softOrder) },
    { label: 'Pairs', rows: buildRows(basicStrategyDatabase.pairs, pairOrder) }
  ];

  const headers = ['Player hand', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

  const makeTable = (table) => `
    <h3>${table.label}</h3>
    <table>
      <thead>
        <tr>${headers.map((label) => `<th>${label}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${table.rows.map((row) => `<tr><th>${row[0]}</th>${row.slice(1).map((value) => `<td>${value}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;

  content.innerHTML = `
    <section class="info-block">
      <h2>How blackjack is played</h2>
      <p>Blackjack is a showdown between the player and the dealer. The goal is to end with a total closer to 21 than the dealer without going over. Number cards count as their face value, face cards count as 10, and aces count as 1 or 11 depending on what helps the hand most.</p>
      <p>The dealer follows a fixed pattern: they hit until they reach 17 or higher, and the player may choose to hit, stand, double, split, surrender, or buy insurance when the dealer shows an Ace.</p>
    </section>

    <section class="info-block">
      <h2>Action explanations</h2>
      <div class="action-list">
        <div><strong>Hit</strong> — Take one more card to try to improve the total.</div>
        <div><strong>Stand</strong> — Keep the current total and end the turn.</div>
        <div><strong>Double</strong> — Double the original wager and receive exactly one more card.</div>
        <div><strong>Split</strong> — If the first two cards match, split into two hands and play each hand separately.</div>
        <div><strong>Surrender</strong> — Give up half the bet to end the hand immediately; good when the hand is weak and the dealer is strong.</div>
        <div><strong>Insurance</strong> — If the dealer shows an Ace, you may insure half your original bet. If the dealer has blackjack, insurance pays 2:1.</div>
      </div>
    </section>

    <section class="info-block">
      <h2>How basic strategy works</h2>
      <p>Basic strategy is the mathematically best decision for each hand based on your total and the dealer's upcard. It reduces the house edge and tells you the best move in the long run: hit, stand, double, split, or surrender.</p>
      <div class="strategy-legend">
        <span>H = Hit</span>
        <span>S = Stand</span>
        <span>D = Double</span>
        <span>P = Split</span>
        <span>R = Surrender</span>
      </div>
      ${strategyTables.map(makeTable).join('')}
      <p class="strategy-note"><strong>Surrender note:</strong> Early surrender is usually correct on hard 15 versus a 10 and hard 16 versus 9, 10, or Ace.</p>
      <p class="strategy-note"><strong>Insurance note:</strong> Insurance is usually a poor basic-strategy play unless you are using a card-counting system with a strong positive true count.</p>
    </section>

    <section class="info-block">
      <h2>Card counting: the Hi-Lo system</h2>
      <p>Card counting doesn't predict individual cards — it tracks how many high cards (which favor the player) versus low cards (which favor the dealer) remain in the shoe. The Hi-Lo system is the most common starting point: every card dealt is worth +1, 0, or -1.</p>
      <div class="strategy-legend">
        <span>2, 3, 4, 5, 6 = +1</span>
        <span>7, 8, 9 = 0</span>
        <span>10, J, Q, K, A = -1</span>
      </div>
      <p><strong>Running count:</strong> Add up the value of every card as it's dealt, starting from 0 each time the shoe is shuffled. If the dealer shows a 5 and a King, and your hand is a 9 and a 3, the running count moves +1 (5), -1 (K), 0 (9), +1 (3) for a total of +1.</p>
      <p><strong>True count:</strong> The running count only tells half the story — a running count of +6 means something very different in a fresh 6-deck shoe than in a shoe with half a deck left. Divide the running count by the number of decks remaining to get the true count: true count = running count ÷ decks remaining. A higher true count means more high cards are left, which favors the player.</p>
      <p><strong>Walkthrough example:</strong> Shoe starts at a running count of 0. A 4 is dealt (+1, running count 1), then a King (-1, running count 0), then a 7 (0, running count 0), then a 2 (+1, running count 1), then an Ace (-1, running count 0). After 5 cards with roughly 5.9 decks remaining, the true count is about 0 ÷ 5.9 ≈ 0.00 — a neutral shoe. As more low cards come out relative to high cards, the running count (and true count) climbs, signaling a shoe that favors the player.</p>
      <p class="strategy-note"><strong>Practice tip:</strong> Use the Running Count Drill in the Card Counting tab to build speed — hands are dealt automatically and you're quizzed on the running count after each one.</p>
    </section>
  `;
}

function renderSettingsScreen() {
  const content = document.getElementById('settingsContent');
  if (!content) return;

  const musicValue = state.settings.musicVolume ?? 100;
  const sfxValue = state.settings.sfxVolume ?? 100;
  const activeScheme = state.settings.colorScheme || 'mystical-casino';
  const is3d = (state.settings.depthMode || '3d') === '3d';

  content.innerHTML = `
    <section class="info-block settings-block">
      <div class="slider-row">
        <label for="musicVolumeSlider">Music volume</label>
        <div class="slider-wrap">
          <input id="musicVolumeSlider" type="range" min="0" max="100" value="${musicValue}" />
          <span>${musicValue}%</span>
        </div>
      </div>

      <div class="slider-row">
        <label for="soundEffectSlider">Sound effects volume</label>
        <div class="slider-wrap">
          <input id="soundEffectSlider" type="range" min="0" max="100" value="${sfxValue}" />
          <span>${sfxValue}%</span>
        </div>
      </div>

      <div class="slider-row">
        <label>Color scheme</label>
        <div class="theme-choice-row">
          <button type="button" class="theme-choice-btn${activeScheme === 'mystical-casino' ? ' active' : ''}" data-theme-choice="mystical-casino">
            <span class="theme-swatch"></span>
            <span class="theme-choice-label">Mystical Casino</span>
            <span class="theme-choice-tagline">Burgundy &amp; violet</span>
          </button>
          <button type="button" class="theme-choice-btn${activeScheme === 'classic-casino' ? ' active' : ''}" data-theme-choice="classic-casino">
            <span class="theme-swatch"></span>
            <span class="theme-choice-label">Classic Casino</span>
            <span class="theme-choice-tagline">Emerald &amp; jade green</span>
          </button>
        </div>
      </div>

      <div class="slider-row">
        <label for="depthModeToggle">3D mode</label>
        <label class="toggle-switch">
          <input type="checkbox" id="depthModeToggle" ${is3d ? 'checked' : ''} />
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
          <span class="toggle-label">${is3d ? 'On — buttons, chips and cards pop with extra depth' : 'Off — clean, flat, premium look'}</span>
        </label>
      </div>
    </section>
  `;

  const musicSlider = document.getElementById('musicVolumeSlider');
  const sfxSlider = document.getElementById('soundEffectSlider');

  const bindSlider = (input, key, updateText) => {
    input.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      state.settings[key] = value;
      updateText.textContent = `${value}%`;

      if (key === 'musicVolume') {
        setupScreenMusic();
        if (state.screen === 'menu' || state.screen === 'rules' || state.screen === 'settings') {
          playScreenMusic('menu');
        }
      }

      if (key === 'sfxVolume') {
        playButtonTone({ frequency: 320, duration: 0.08, volume: 0.1, type: 'triangle', sweep: 20 });
      }
    });
  };

  if (musicSlider) bindSlider(musicSlider, 'musicVolume', musicSlider.parentElement.querySelector('span'));
  if (sfxSlider) bindSlider(sfxSlider, 'sfxVolume', sfxSlider.parentElement.querySelector('span'));

  content.querySelectorAll('.theme-choice-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.themeChoice;
      if (choice === state.settings.colorScheme) return;
      state.settings.colorScheme = choice;
      applyColorScheme(choice);
      content.querySelectorAll('.theme-choice-btn').forEach((b) => b.classList.toggle('active', b.dataset.themeChoice === choice));
      playButtonTone({ frequency: 380, duration: 0.09, volume: 0.11, type: 'triangle', sweep: 24 });
    });
  });

  const depthToggle = document.getElementById('depthModeToggle');
  if (depthToggle) {
    depthToggle.addEventListener('change', (event) => {
      const mode = event.target.checked ? '3d' : 'flat';
      state.settings.depthMode = mode;
      applyDepthMode(mode);
      const label = depthToggle.parentElement.querySelector('.toggle-label');
      if (label) {
        label.textContent = mode === '3d'
          ? 'On — buttons, chips and cards pop with extra depth'
          : 'Off — clean, flat, premium look';
      }
      playButtonTone({ frequency: 360, duration: 0.09, volume: 0.11, type: 'triangle', sweep: 24 });
    });
  }
}

function renderStrategyScreen() {
  state.strategyState.mistakes = loadMistakesFromStorage();
  updateMistakesBadge();
  elements.strategySurrenderToggle.checked = state.settings.surrenderEnabled;
  showPracticeView();
}

function bindGameDealingSpeedSlider() {
  const slider = elements.gameDealingSpeedSlider;
  const valueLabel = elements.gameDealingSpeedValue;
  if (!slider || !valueLabel) return;

  slider.value = state.settings.dealingSpeed ?? 80;
  valueLabel.textContent = `${slider.value}%`;

  slider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.settings.dealingSpeed = value;
    valueLabel.textContent = `${value}%`;
    playButtonTone({ frequency: 440, duration: 0.08, volume: 0.12, type: 'sine', sweep: 30 });
  });
}

/* ------------------------------------------------------------------------ */
/* Running Count Drill                                                       */
/* ------------------------------------------------------------------------ */

function bindCountingDrillEvents() {
  elements.drillDecksSelect.addEventListener('change', (event) => {
    state.countingDrill.decksInShoe = Number(event.target.value);
    resetDrillSession();
  });

  elements.drillSpeedSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.countingDrill.dealingSpeedMs = value;
    elements.drillSpeedValue.textContent = `${value}ms`;
  });

  elements.drillHandsSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.countingDrill.numHands = value;
    elements.drillHandsValue.textContent = String(value);
  });

  elements.drillResetBtn.addEventListener('click', resetDrillSession);
}

function ensureDrillStarted() {
  if (state.countingDrill.isDealing) return;
  hideModal();
  runDrillRound();
}

function pauseDrillSession() {
  state.countingDrill.sessionId += 1;
  state.countingDrill.isDealing = false;
  hideModal();
}

function resetDrillSession() {
  state.countingDrill.sessionId += 1;
  state.countingDrill.shoe = createShoe(state.countingDrill.decksInShoe);
  state.countingDrill.runningCount = 0;
  state.countingDrill.isDealing = false;
  hideModal();
  runDrillRound();
}

function drillDrawCard() {
  if (state.countingDrill.shoe.length === 0) {
    state.countingDrill.shoe = createShoe(state.countingDrill.decksInShoe);
    state.countingDrill.runningCount = 0;
  }
  return state.countingDrill.shoe.pop();
}

function applyDrillCountValue(card) {
  state.countingDrill.runningCount += getCardCountingValue(card);
}

function renderDrillHandZones() {
  elements.drillDealerHand.innerHTML = '';
  const container = elements.drillPlayerHands;
  container.innerHTML = '';

  for (let i = 0; i < state.countingDrill.numHands; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'split-hand active drill-hand';
    wrapper.dataset.drillHandIndex = String(i);
    container.appendChild(wrapper);
  }
}

function clearDrillTable() {
  elements.drillDealerHand.innerHTML = '';
  elements.drillPlayerHands.querySelectorAll('.drill-hand').forEach((wrapper) => {
    wrapper.innerHTML = '';
  });
}

function renderDrillCardEl(card) {
  const classes = ['card'];
  if (card.suit === '♥' || card.suit === '♦') classes.push('red');
  return `<div class="${classes.join(' ')}">${cardToText(card)}</div>`;
}

function renderDrillPlayerHand(handIndex, hand) {
  const wrapper = elements.drillPlayerHands.querySelector(`[data-drill-hand-index="${handIndex}"]`);
  if (!wrapper) return;
  wrapper.innerHTML = hand.map(renderDrillCardEl).join('');
}

function renderDrillDealerHand(hand, revealHole) {
  elements.drillDealerHand.innerHTML = hand
    .map((card, index) => {
      const hide = !revealHole && index === 1;
      if (hide) return '<div class="card back">??</div>';
      return renderDrillCardEl(card);
    })
    .join('');
}

async function dealDrillPlayerCard(handIndex, hand, card) {
  hand.push(card);
  renderDrillPlayerHand(handIndex, hand);
  playCardDealingSound();
  await wait(state.countingDrill.dealingSpeedMs);
}

async function dealDrillDealerCard(hand, card, revealHole) {
  hand.push(card);
  renderDrillDealerHand(hand, revealHole);
  playCardDealingSound();
  await wait(state.countingDrill.dealingSpeedMs);
}

async function autoPlayDrillHand(hand, dealerUpCard, handIndex, mySession) {
  while (true) {
    if (state.countingDrill.sessionId !== mySession) return;
    const total = scoreHand(hand);
    if (total > 21) return;

    const action = hasSoftTotal(hand) ? softStrategy(total, dealerUpCard.value) : hardStrategy(total, dealerUpCard.value);

    if (action === 'D' && hand.length === 2) {
      const card = drillDrawCard();
      applyDrillCountValue(card);
      await dealDrillPlayerCard(handIndex, hand, card);
      return;
    }

    if (action === 'H') {
      const card = drillDrawCard();
      applyDrillCountValue(card);
      await dealDrillPlayerCard(handIndex, hand, card);
      continue;
    }

    return;
  }
}

async function autoPlayDrillDealer(dealerHand, mySession) {
  if (state.countingDrill.sessionId !== mySession) return;

  // Reveal the hole card - only now does its value join the running count.
  applyDrillCountValue(dealerHand[1]);
  renderDrillDealerHand(dealerHand, true);
  await wait(state.countingDrill.dealingSpeedMs);

  while (scoreHand(dealerHand) < 17) {
    if (state.countingDrill.sessionId !== mySession) return;
    const card = drillDrawCard();
    applyDrillCountValue(card);
    await dealDrillDealerCard(dealerHand, card, true);
  }
}

async function runDrillRound() {
  const mySession = state.countingDrill.sessionId;
  state.countingDrill.isDealing = true;
  elements.drillStatus.textContent = 'Dealing...';

  renderDrillHandZones();

  const numHands = state.countingDrill.numHands;
  const playerHands = Array.from({ length: numHands }, () => []);
  const dealerHand = [];

  for (let i = 0; i < numHands; i++) {
    if (state.countingDrill.sessionId !== mySession) return;
    const card = drillDrawCard();
    applyDrillCountValue(card);
    await dealDrillPlayerCard(i, playerHands[i], card);
  }

  if (state.countingDrill.sessionId !== mySession) return;
  {
    const card = drillDrawCard();
    applyDrillCountValue(card);
    await dealDrillDealerCard(dealerHand, card, false);
  }

  for (let i = 0; i < numHands; i++) {
    if (state.countingDrill.sessionId !== mySession) return;
    const card = drillDrawCard();
    applyDrillCountValue(card);
    await dealDrillPlayerCard(i, playerHands[i], card);
  }

  if (state.countingDrill.sessionId !== mySession) return;
  {
    // Hole card stays face-down and uncounted until the dealer reveals it.
    const card = drillDrawCard();
    await dealDrillDealerCard(dealerHand, card, false);
  }

  const dealerUpCard = dealerHand[0];

  for (let i = 0; i < numHands; i++) {
    if (state.countingDrill.sessionId !== mySession) return;
    await autoPlayDrillHand(playerHands[i], dealerUpCard, i, mySession);
  }

  if (state.countingDrill.sessionId !== mySession) return;
  await autoPlayDrillDealer(dealerHand, mySession);

  if (state.countingDrill.sessionId !== mySession) return;
  elements.drillStatus.textContent = 'Hand complete. Memorize the count...';
  await wait(ROUND_SUMMARY_DELAY_MS);

  if (state.countingDrill.sessionId !== mySession) return;
  clearDrillTable();
  state.countingDrill.isDealing = false;
  elements.drillStatus.textContent = 'What is the running count?';
  showRunningCountGuessModal(mySession);
}

function showRunningCountGuessModal(mySession) {
  elements.modalTitle.textContent = 'What is the running count?';
  elements.modalMessage.textContent = 'Enter your best guess for the current running count.';
  elements.modalActions.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'drill-guess-input';
  input.placeholder = 'Running count';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'menu-btn primary';
  submitBtn.textContent = 'Submit';

  const submit = () => {
    if (state.countingDrill.sessionId !== mySession) return;
    if (input.value.trim() === '' || !Number.isFinite(Number(input.value))) return;
    const guess = Number(input.value);
    showDrillFeedback(guess, mySession);
  };

  submitBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });

  elements.modalActions.appendChild(input);
  elements.modalActions.appendChild(submitBtn);
  showModalOverlay();
  setTimeout(() => input.focus(), 50);
}

function showDrillFeedback(guess, mySession) {
  const actual = state.countingDrill.runningCount;
  const isCorrect = guess === actual;

  elements.modalTitle.textContent = isCorrect ? 'Correct!' : 'Not quite';
  elements.modalMessage.textContent = isCorrect
    ? `The running count is ${actual}. Nice counting!`
    : `You guessed ${guess}, but the actual running count is ${actual}.`;
  elements.modalActions.innerHTML = '';

  const continueBtn = document.createElement('button');
  continueBtn.type = 'button';
  continueBtn.className = 'menu-btn primary';
  continueBtn.textContent = 'Continue';
  continueBtn.addEventListener('click', () => {
    hideModal();
    if (state.countingDrill.sessionId !== mySession) return;
    runDrillRound();
  });

  elements.modalActions.appendChild(continueBtn);
  showModalOverlay();
}

function showModal(title, message, options, callback) {
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modalActions.innerHTML = '';

  options.forEach((option, index) => {
    const button = document.createElement('button');
    button.textContent = option;
    button.addEventListener('click', () => {
      hideModal();
      if (callback) callback(index);
    });
    elements.modalActions.appendChild(button);
  });

  showModalOverlay();
}

function appendLog(message) {
  if (elements.logArea) {
    const line = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${message}`;
    elements.logArea.textContent += `${line}\n`;
    elements.logArea.scrollTop = elements.logArea.scrollHeight;
  }
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function formatSignedCurrency(value) {
  const prefix = value >= 0 ? '+' : '-';
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}

function calculateRunningCount() {
  return state.countingState.runningCount;
}

function resetGame() {
  state.balance = 1000;
  state.currentBet = 0;
  state.lastBetAmount = 25;
  state.dealerHand = [];
  state.playerHands = [];
  state.handBets = [];
  state.activeHandIndex = 0;
  state.roundActive = false;
  state.shoe = createShoe(state.settings.decksInShoe);
  state.countingState.runningCount = 0;
  state.countingState.decksRemaining = state.shoe.length / 52;
  state.countingState.trueCount = 0;
  updateHud();
}

window.addEventListener('beforeunload', () => {
  if (state.modal) {
    state.modal = null;
  }
});
