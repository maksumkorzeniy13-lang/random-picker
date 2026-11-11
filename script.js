(() => {
  'use strict';

  const input = document.querySelector('#options-input');
  const addButton = document.querySelector('#add-options');
  const clearOptionsButton = document.querySelector('#clear-options');
  const optionList = document.querySelector('#option-list');
  const emptyOptions = document.querySelector('#empty-options');
  const itemCount = document.querySelector('#item-count');
  const pickButton = document.querySelector('#pick-button');
  const resultCard = document.querySelector('#result-card');
  const resultValue = document.querySelector('#result-value');
  const errorMessage = document.querySelector('#error-message');
  const copyButton = document.querySelector('#copy-button');
  const copyStatus = document.querySelector('#copy-status');
  const historyList = document.querySelector('#history-list');
  const emptyHistory = document.querySelector('#empty-history');
  const clearHistoryButton = document.querySelector('#clear-history');
  const historyCount = document.querySelector('#history-count');
  const normalModeTab = document.querySelector('#normal-mode-tab');
  const wheelModeTab = document.querySelector('#wheel-mode-tab');
  const normalModeContent = document.querySelector('#normal-mode-content');
  const wheelModeContent = document.querySelector('#wheel-mode-content');
  const wheelCanvas = document.querySelector('#wheel-canvas');
  const wheelStage = document.querySelector('.wheel-stage');
  const spinButton = document.querySelector('#spin-button');
  const wheelError = document.querySelector('#wheel-error');
  const wheelWinner = document.querySelector('#wheel-winner');
  const wheelContext = wheelCanvas.getContext('2d');

  const storageKey = 'random-picker-state-v1';

  function loadSavedState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      return {
        options: Array.isArray(saved.options) ? saved.options.filter((item) => typeof item === 'string') : [],
        history: Array.isArray(saved.history) ? saved.history.filter((item) => typeof item === 'string').slice(0, 8) : []
      };
    } catch {
      return { options: [], history: [] };
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ options, history }));
    } catch (error) {
      console.warn('Не вдалося зберегти дані Random Picker у цьому браузері.', error);
    }
  }

  const savedState = loadSavedState();
  let options = savedState.options;
  let history = savedState.history;
  let currentResult = '';
  let isPicking = false;
  let isWheelSpinning = false;
  let wheelRotation = 0;
  const wheelStartAngle = -Math.PI / 2;
  const wheelColors = ['#7655b7', '#cf7184', '#3d9c91', '#c58b48', '#5777bb', '#ab659e', '#72914f', '#cc6952', '#4f91b7', '#a27643'];

  function normalizeAngle(angle) {
    const fullCircle = Math.PI * 2;
    return ((angle % fullCircle) + fullCircle) % fullCircle;
  }

  function drawWheel() {
    const size = wheelCanvas.width;
    const center = size / 2;
    const radius = center - 10;
    const slice = options.length ? (Math.PI * 2) / options.length : 0;
    wheelContext.clearRect(0, 0, size, size);
    wheelStage.classList.toggle('has-sectors', options.length > 0);

    if (!options.length) {
      wheelContext.beginPath();
      wheelContext.arc(center, center, radius, 0, Math.PI * 2);
      wheelContext.fillStyle = '#292631';
      wheelContext.fill();
      wheelContext.strokeStyle = '#51485f';
      wheelContext.lineWidth = 3;
      wheelContext.stroke();
      return;
    }

    options.forEach((option, index) => {
      const start = wheelStartAngle + index * slice;
      const end = start + slice;
      wheelContext.beginPath();
      wheelContext.moveTo(center, center);
      wheelContext.arc(center, center, radius, start, end);
      wheelContext.closePath();
      wheelContext.fillStyle = wheelColors[index % wheelColors.length];
      wheelContext.fill();
      wheelContext.strokeStyle = '#211d29';
      wheelContext.lineWidth = 3;
      wheelContext.stroke();

      const middle = start + slice / 2;
      const labelRadius = radius * 0.63;
      const fontSize = Math.max(9, Math.min(14, 190 / options.length));
      const maxWidth = Math.max(28, labelRadius * slice * 0.86);
      let label = option;
      wheelContext.font = `600 ${fontSize}px system-ui, sans-serif`;
      while (label.length > 3 && wheelContext.measureText(`${label}…`).width > maxWidth) label = label.slice(0, -1);
      if (label !== option) label += '…';
      wheelContext.save();
      wheelContext.translate(center + Math.cos(middle) * labelRadius, center + Math.sin(middle) * labelRadius);
      wheelContext.fillStyle = '#fff';
      wheelContext.textAlign = 'center';
      wheelContext.textBaseline = 'middle';
      wheelContext.shadowColor = '#17131f99';
      wheelContext.shadowBlur = 3;
      wheelContext.fillText(label, 0, 0, maxWidth);
      wheelContext.restore();
    });

    wheelContext.beginPath();
    wheelContext.arc(center, center, 17, 0, Math.PI * 2);
    wheelContext.fillStyle = '#f0e9ff';
    wheelContext.fill();
    wheelContext.strokeStyle = '#372c48';
    wheelContext.lineWidth = 4;
    wheelContext.stroke();
  }

  function setMode(mode) {
    if (isWheelSpinning) return;
    const wheelActive = mode === 'wheel';
    normalModeTab.classList.toggle('is-active', !wheelActive);
    wheelModeTab.classList.toggle('is-active', wheelActive);
    normalModeTab.setAttribute('aria-selected', String(!wheelActive));
    wheelModeTab.setAttribute('aria-selected', String(wheelActive));
    normalModeContent.hidden = wheelActive;
    wheelModeContent.hidden = !wheelActive;
    errorMessage.hidden = true;
    wheelError.hidden = true;
  }

  function renderOptions() {
    optionList.replaceChildren();
    options.forEach((option, index) => {
      const row = document.createElement('li');
      row.className = 'option-row';
      const name = document.createElement('span');
      name.className = 'option-name';
      name.textContent = option;
      const remove = document.createElement('button');
      remove.className = 'remove-button';
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Видалити варіант: ${option}`);
      remove.disabled = isWheelSpinning;
      remove.addEventListener('click', () => {
        options.splice(index, 1);
        renderOptions();
        if (options.length === 0) showError();
      });
      row.append(name, remove);
      optionList.append(row);
    });
    const count = options.length;
    itemCount.textContent = `${count} ${count === 1 ? 'варіант' : count >= 2 && count <= 4 ? 'варіанти' : 'варіантів'}`;
    emptyOptions.hidden = count > 0;
    clearOptionsButton.disabled = count === 0 || isWheelSpinning;
    addButton.disabled = isWheelSpinning;
    input.disabled = isWheelSpinning;
    spinButton.disabled = count === 0 || isWheelSpinning;
    drawWheel();
    saveState();
  }

  function renderHistory() {
    historyList.replaceChildren();
    history.forEach((entry, index) => {
      const row = document.createElement('li');
      row.className = 'history-row';
      const number = document.createElement('span');
      number.className = 'history-index';
      number.textContent = String(history.length - index).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'history-name';
      name.textContent = entry;
      row.append(number, name);
      historyList.append(row);
    });
    emptyHistory.hidden = history.length > 0;
    clearHistoryButton.disabled = history.length === 0;
    historyCount.textContent = String(history.length);
    saveState();
  }

  function showError() {
    errorMessage.hidden = false;
    input.focus();
  }

  function addOptions() {
    if (isWheelSpinning) return;
    const incoming = input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (incoming.length === 0) {
      input.focus();
      return;
    }
    options.push(...incoming);
    input.value = '';
    errorMessage.hidden = true;
    renderOptions();
    input.focus();
  }

  function pickRandom() {
    if (isPicking) return;
    if (options.length === 0) {
      showError();
      return;
    }
    isPicking = true;
    errorMessage.hidden = true;
    pickButton.disabled = true;
    const interval = window.setInterval(() => {
      resultValue.textContent = options[Math.floor(Math.random() * options.length)];
      resultValue.classList.remove('placeholder');
    }, 75);

    window.setTimeout(() => {
      window.clearInterval(interval);
      currentResult = options[Math.floor(Math.random() * options.length)];
      resultValue.textContent = currentResult;
      resultCard.classList.add('has-result', 'is-rolling');
      copyButton.disabled = false;
      history.unshift(currentResult);
      if (history.length > 8) history.pop();
      renderHistory();
      pickButton.disabled = false;
      isPicking = false;
      copyStatus.textContent = '';
      window.setTimeout(() => resultCard.classList.remove('is-rolling'), 350);
    }, 850);
  }

  function spinWheel() {
    if (isWheelSpinning) return;
    if (options.length === 0) {
      wheelError.hidden = false;
      return;
    }
    wheelError.hidden = true;
    wheelWinner.hidden = true;
    isWheelSpinning = true;
    renderOptions();

    const slice = (Math.PI * 2) / options.length;
    const targetIndex = Math.floor(Math.random() * options.length);
    const desiredAngle = normalizeAngle(-(targetIndex + 0.5) * slice);
    const currentAngle = normalizeAngle(wheelRotation);
    const extraAngle = normalizeAngle(desiredAngle - currentAngle);
    const finalRotation = wheelRotation + Math.PI * 2 * 7 + extraAngle;
    const duration = 5200;
    wheelCanvas.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.08,1)`;
    wheelCanvas.style.transform = `rotate(${finalRotation}rad)`;
    wheelRotation = finalRotation;

    window.setTimeout(() => {
      const angleAtPointer = normalizeAngle(-wheelRotation);
      const winnerIndex = Math.floor(angleAtPointer / slice) % options.length;
      const winner = options[winnerIndex];
      wheelWinner.textContent = `Переможець: ${winner}`;
      wheelWinner.hidden = false;
      history.unshift(winner);
      if (history.length > 8) history.pop();
      renderHistory();
      isWheelSpinning = false;
      renderOptions();
    }, duration + 80);
  }

  async function copyResult() {
    if (!currentResult) return;
    try {
      await navigator.clipboard.writeText(currentResult);
      copyStatus.textContent = 'Скопійовано!';
    } catch {
      const temporary = document.createElement('textarea');
      temporary.value = currentResult;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.append(temporary);
      temporary.select();
      const copied = document.execCommand('copy');
      temporary.remove();
      copyStatus.textContent = copied ? 'Скопійовано!' : 'Не вдалося скопіювати результат.';
    }
  }

  addButton.addEventListener('click', addOptions);
  input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') addOptions();
  });
  clearOptionsButton.addEventListener('click', () => {
    options = [];
    renderOptions();
    errorMessage.hidden = true;
  });
  pickButton.addEventListener('click', pickRandom);
  copyButton.addEventListener('click', copyResult);
  clearHistoryButton.addEventListener('click', () => {
    history = [];
    renderHistory();
  });
  normalModeTab.addEventListener('click', () => setMode('normal'));
  wheelModeTab.addEventListener('click', () => setMode('wheel'));
  spinButton.addEventListener('click', spinWheel);

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .catch((error) => console.warn('Не вдалося зареєструвати офлайн-режим.', error));
    });
  }

  renderOptions();
  renderHistory();
})();
