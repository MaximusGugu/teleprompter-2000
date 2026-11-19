(() => {
  'use strict';

  const STORAGE_KEY = 'cueflow.teleprompter.v1';
  const MAX_SPEED = 30;
  const DEFAULT_TEXT = `Respire. Olhe para a câmera. E comece no seu ritmo.

Este é o Prompto, um teleprompter simples para deixar sua apresentação mais natural. Use os controles abaixo para ajustar a leitura do jeito que funciona melhor para você.

Quando estiver pronto, pressione o botão de play — ou a barra de espaço — e deixe as palavras acompanharem a sua voz.`;

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    body: document.body,
    editorPanel: $('#editorPanel'),
    editorToggle: $('#editorToggle'),
    panelClose: $('#panelClose'),
    stageEditorButton: $('#stageEditorButton'),
    title: $('#scriptTitle'),
    text: $('#scriptText'),
    wordCount: $('#wordCount'),
    saveButton: $('#saveButton'),
    newButton: $('#newButton'),
    scriptList: $('#scriptList'),
    scriptTotal: $('#scriptTotal'),
    saveState: $('#saveState'),
    viewport: $('#promptViewport'),
    prompt: $('#promptText'),
    stage: $('#stage'),
    stageEmpty: $('#stageEmpty'),
    fontSize: $('#fontSize'),
    fontSizeValue: $('#fontSizeValue'),
    lineHeight: $('#lineHeight'),
    lineHeightValue: $('#lineHeightValue'),
    textColor: $('#textColor'),
    backgroundColor: $('#backgroundColor'),
    mirrorH: $('#mirrorHorizontal'),
    mirrorV: $('#mirrorVertical'),
    speedRange: $('#speedRange'),
    speedValue: $('#speedValue'),
    highlightToggle: $('#highlightToggle'),
    playButton: $('#playButton'),
    fullscreenPlayButton: $('#fullscreenPlayButton'),
    controlDock: $('#controlDock'),
    resetButton: $('#resetButton'),
    fullscreenButton: $('#fullscreenButton'),
    toast: $('#toast')
  };

  let state = loadState();
  let activeId = state.activeId || null;
  let isPlaying = false;
  let animationFrame = null;
  let lastTimestamp = 0;
  let saveTimer = null;
  let toastTimer = null;
  let fullscreenControlsTimer = null;
  let activeLineFrame = null;
  let hasEnded = false;

  function defaultState() {
    return {
      scripts: [],
      activeId: null,
      draft: { title: 'Meu primeiro roteiro', text: DEFAULT_TEXT },
      settings: {
        fontSize: 64,
        lineHeight: 1.35,
        textColor: '#f4f1e9',
        backgroundColor: '#08090b',
        speed: 3,
        highlightLine: true,
        mirrorH: false,
        mirrorV: false
      }
    };
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const fallback = defaultState();
      if (!stored || typeof stored !== 'object') return fallback;
      return {
        ...fallback,
        ...stored,
        scripts: Array.isArray(stored.scripts) ? stored.scripts : [],
        draft: { ...fallback.draft, ...(stored.draft || {}) },
        settings: { ...fallback.settings, ...(stored.settings || {}) }
      };
    } catch {
      return defaultState();
    }
  }

  function persist({ quiet = true } = {}) {
    state.activeId = activeId;
    state.draft = { title: elements.title.value, text: elements.text.value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    elements.saveState.classList.remove('saving');
    elements.saveState.innerHTML = '<i></i> Salvo neste dispositivo';
    if (!quiet) showToast('Roteiro salvo neste navegador');
  }

  function schedulePersist() {
    elements.saveState.classList.add('saving');
    elements.saveState.innerHTML = '<i></i> Salvando alterações…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(), 350);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2300);
  }

  function formatDate(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function countWords(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  function updatePrompt() {
    const text = elements.text.value;
    renderPromptText(text);
    const words = countWords(text);
    elements.wordCount.textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
    elements.stageEmpty.hidden = Boolean(text.trim());
  }

  function renderPromptText(text) {
    const fragment = document.createDocumentFragment();
    const notePattern = /\*([^*\n]+)\*/g;
    let cursor = 0;
    let match;

    while ((match = notePattern.exec(text)) !== null) {
      if (match.index > cursor) appendPromptSegment(fragment, text.slice(cursor, match.index), false);
      appendPromptSegment(fragment, match[1], true);
      cursor = notePattern.lastIndex;
    }
    if (cursor < text.length) appendPromptSegment(fragment, text.slice(cursor), false);
    elements.prompt.replaceChildren(fragment);
    scheduleActiveLineUpdate();
  }

  function appendPromptSegment(fragment, text, isNote) {
    const chunks = text.match(/\s+|[^\s]+/g) || [];
    chunks.forEach(chunk => {
      if (/^\s+$/.test(chunk)) {
        fragment.append(document.createTextNode(chunk));
        return;
      }
      const token = document.createElement('span');
      token.className = `prompt-token${isNote ? ' cue-note' : ''}`;
      token.textContent = chunk;
      fragment.append(token);
    });
  }

  function updateActiveLine() {
    activeLineFrame = null;
    const tokens = Array.from(elements.prompt.querySelectorAll('.prompt-token'));
    if (!tokens.length) return;

    tokens.forEach(token => token.classList.remove('active-line'));
    if (!state.settings.highlightLine) return;

    const viewportRect = elements.viewport.getBoundingClientRect();
    const middle = viewportRect.top + viewportRect.height / 2;
    let nearestTop = null;
    let nearestDistance = Infinity;

    tokens.forEach(token => {
      const rect = token.getBoundingClientRect();
      const distance = Math.abs((rect.top + rect.bottom) / 2 - middle);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTop = rect.top;
      }
    });

    if (nearestTop === null) return;
    tokens.forEach(token => {
      if (Math.abs(token.getBoundingClientRect().top - nearestTop) < 3) token.classList.add('active-line');
    });
  }

  function scheduleActiveLineUpdate() {
    if (activeLineFrame) return;
    activeLineFrame = requestAnimationFrame(updateActiveLine);
  }

  function renderLibrary() {
    elements.scriptTotal.textContent = String(state.scripts.length);
    if (!state.scripts.length) {
      elements.scriptList.innerHTML = '<div class="library-empty">Nenhum roteiro salvo ainda.</div>';
      return;
    }

    elements.scriptList.innerHTML = state.scripts
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(script => `
        <div class="script-card ${script.id === activeId ? 'active' : ''}" data-id="${script.id}" role="button" tabindex="0">
          <div class="script-info">
            <strong>${escapeHtml(script.title || 'Sem título')}</strong>
            <span>${countWords(script.text)} palavras · ${formatDate(script.updatedAt)}</span>
          </div>
          <button class="delete-script" type="button" data-delete="${script.id}" aria-label="Excluir ${escapeHtml(script.title || 'roteiro')}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>
          </button>
        </div>
      `).join('');
  }

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = value;
    return node.innerHTML;
  }

  function saveScript() {
    const title = elements.title.value.trim() || 'Sem título';
    const text = elements.text.value.trim();
    if (!text) {
      showToast('Adicione algum texto antes de salvar');
      elements.text.focus();
      return;
    }

    const now = new Date().toISOString();
    if (activeId) {
      const index = state.scripts.findIndex(script => script.id === activeId);
      if (index >= 0) state.scripts[index] = { ...state.scripts[index], title, text, updatedAt: now };
      else activeId = null;
    }
    if (!activeId) {
      activeId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `script-${Date.now()}`;
      state.scripts.push({ id: activeId, title, text, createdAt: now, updatedAt: now });
    }
    elements.title.value = title;
    persist({ quiet: false });
    renderLibrary();
  }

  function loadScript(id) {
    const script = state.scripts.find(item => item.id === id);
    if (!script) return;
    pause();
    activeId = script.id;
    elements.title.value = script.title;
    elements.text.value = script.text;
    updatePrompt();
    resetScroll(false);
    persist();
    renderLibrary();
    showToast(`“${script.title}” carregado`);
  }

  function newScript() {
    pause();
    activeId = null;
    elements.title.value = 'Novo roteiro';
    elements.text.value = '';
    updatePrompt();
    resetScroll(false);
    persist();
    renderLibrary();
    elements.text.focus();
  }

  function deleteScript(id) {
    const script = state.scripts.find(item => item.id === id);
    if (!script) return;
    state.scripts = state.scripts.filter(item => item.id !== id);
    if (activeId === id) activeId = null;
    persist();
    renderLibrary();
    showToast('Roteiro excluído');
  }

  function applySettings() {
    const settings = state.settings;
    elements.fontSize.value = settings.fontSize;
    elements.fontSizeValue.value = settings.fontSize;
    elements.lineHeight.value = settings.lineHeight;
    elements.lineHeightValue.value = Number(settings.lineHeight).toFixed(2).replace(/0$/, '');
    elements.textColor.value = settings.textColor;
    elements.backgroundColor.value = settings.backgroundColor;
    elements.speedRange.value = settings.speed;
    elements.speedValue.value = settings.speed;
    elements.highlightToggle.checked = settings.highlightLine;
    elements.mirrorH.setAttribute('aria-pressed', String(settings.mirrorH));
    elements.mirrorV.setAttribute('aria-pressed', String(settings.mirrorV));
    elements.prompt.style.fontSize = `${settings.fontSize}px`;
    elements.prompt.style.lineHeight = settings.lineHeight;
    elements.prompt.style.color = settings.textColor;
    elements.prompt.classList.toggle('highlight-disabled', !settings.highlightLine);
    elements.stage.style.backgroundColor = settings.backgroundColor;
    elements.prompt.style.transform = `scaleX(${settings.mirrorH ? -1 : 1}) scaleY(${settings.mirrorV ? -1 : 1})`;
    scheduleActiveLineUpdate();
  }

  function updateSetting(key, value) {
    state.settings[key] = value;
    applySettings();
    schedulePersist();
  }

  function changeSpeed(delta) {
    const next = Math.min(MAX_SPEED, Math.max(1, Number(state.settings.speed) + delta));
    updateSetting('speed', next);
  }

  function frame(timestamp) {
    if (!isPlaying) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = Math.min(50, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    const pixelsPerSecond = 9 + state.settings.speed * 10;
    elements.viewport.scrollTop += (pixelsPerSecond * elapsed) / 1000;
    scheduleActiveLineUpdate();
    const reachedEnd = elements.viewport.scrollTop + elements.viewport.clientHeight >= elements.viewport.scrollHeight - 2;
    if (reachedEnd) {
      hasEnded = true;
      pause();
      showToast('Fim do roteiro');
      return;
    }
    animationFrame = requestAnimationFrame(frame);
  }

  function play() {
    if (!elements.text.value.trim()) {
      showToast('Adicione um roteiro para começar');
      return;
    }
    hasEnded = false;
    isPlaying = true;
    lastTimestamp = 0;
    updatePlaybackButtons();
    animationFrame = requestAnimationFrame(frame);
  }

  function pause() {
    isPlaying = false;
    lastTimestamp = 0;
    cancelAnimationFrame(animationFrame);
    updatePlaybackButtons();
  }

  function updatePlaybackButtons() {
    [elements.playButton, elements.fullscreenPlayButton].forEach(button => {
      button.classList.toggle('is-playing', isPlaying);
      button.classList.toggle('is-ended', hasEnded);
      button.setAttribute('aria-label', hasEnded ? 'Reiniciar roteiro' : isPlaying ? 'Pausar teleprompter' : 'Iniciar teleprompter');
    });
  }

  function togglePlay() {
    if (hasEnded) {
      resetScroll(false);
      return;
    }
    isPlaying ? pause() : play();
  }

  function resetScroll(notify = true) {
    hasEnded = false;
    pause();
    elements.viewport.scrollTo({ top: 0, behavior: 'smooth' });
    if (notify) showToast('Roteiro reiniciado');
  }

  function toggleEditor(force) {
    const shouldHide = typeof force === 'boolean' ? !force : !elements.body.classList.contains('editor-hidden');
    elements.body.classList.toggle('editor-hidden', shouldHide);
    elements.editorToggle.setAttribute('aria-expanded', String(!shouldHide));
  }

  function hideFullscreenControls() {
    clearTimeout(fullscreenControlsTimer);
    elements.body.classList.remove('controls-visible');
  }

  function showFullscreenControls() {
    if (!elements.body.classList.contains('stage-fullscreen')) return;
    elements.body.classList.add('controls-visible');
    clearTimeout(fullscreenControlsTimer);
    fullscreenControlsTimer = setTimeout(hideFullscreenControls, 3500);
  }

  function toggleFullscreenControls() {
    if (!elements.body.classList.contains('stage-fullscreen')) return;
    elements.body.classList.contains('controls-visible') ? hideFullscreenControls() : showFullscreenControls();
  }

  function setFullscreenUI(active) {
    elements.body.classList.toggle('stage-fullscreen', active);
    elements.fullscreenButton.setAttribute('aria-label', active ? 'Sair da tela cheia' : 'Abrir em tela cheia');
    elements.fullscreenButton.title = active ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
    hideFullscreenControls();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        toggleEditor(false);
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreenUI(!elements.body.classList.contains('stage-fullscreen'));
    }
  }

  elements.text.addEventListener('input', () => { updatePrompt(); schedulePersist(); });
  elements.title.addEventListener('input', schedulePersist);
  elements.saveButton.addEventListener('click', saveScript);
  elements.newButton.addEventListener('click', newScript);

  elements.scriptList.addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-delete]');
    if (deleteButton) { event.stopPropagation(); deleteScript(deleteButton.dataset.delete); return; }
    const card = event.target.closest('[data-id]');
    if (card) loadScript(card.dataset.id);
  });
  elements.scriptList.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-id]')) loadScript(event.target.dataset.id);
  });

  elements.fontSize.addEventListener('input', event => updateSetting('fontSize', Number(event.target.value)));
  elements.lineHeight.addEventListener('input', event => updateSetting('lineHeight', Number(event.target.value)));
  elements.textColor.addEventListener('input', event => updateSetting('textColor', event.target.value));
  elements.backgroundColor.addEventListener('input', event => updateSetting('backgroundColor', event.target.value));
  elements.mirrorH.addEventListener('click', () => updateSetting('mirrorH', !state.settings.mirrorH));
  elements.mirrorV.addEventListener('click', () => updateSetting('mirrorV', !state.settings.mirrorV));
  elements.speedRange.addEventListener('input', event => updateSetting('speed', Number(event.target.value)));
  elements.highlightToggle.addEventListener('change', event => updateSetting('highlightLine', event.target.checked));
  elements.playButton.addEventListener('click', togglePlay);
  elements.fullscreenPlayButton.addEventListener('click', togglePlay);
  elements.resetButton.addEventListener('click', () => resetScroll());
  elements.editorToggle.addEventListener('click', () => toggleEditor());
  elements.panelClose.addEventListener('click', () => toggleEditor(false));
  elements.stageEditorButton.addEventListener('click', () => toggleEditor(true));
  elements.fullscreenButton.addEventListener('click', toggleFullscreen);
  elements.prompt.addEventListener('click', toggleFullscreenControls);
  elements.viewport.addEventListener('scroll', scheduleActiveLineUpdate, { passive: true });
  elements.controlDock.addEventListener('pointerdown', showFullscreenControls);
  elements.controlDock.addEventListener('input', showFullscreenControls);
  document.addEventListener('fullscreenchange', () => setFullscreenUI(Boolean(document.fullscreenElement)));
  window.addEventListener('resize', scheduleActiveLineUpdate);

  document.addEventListener('keydown', event => {
    const editing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (event.code === 'Space' && !editing) { event.preventDefault(); togglePlay(); }
    if (event.key === 'ArrowUp' && !editing) { event.preventDefault(); changeSpeed(1); }
    if (event.key === 'ArrowDown' && !editing) { event.preventDefault(); changeSpeed(-1); }
    if (event.key === 'Home' && !editing) { event.preventDefault(); resetScroll(); }
    if (event.key.toLowerCase() === 'f' && !editing) toggleFullscreen();
    if (event.key.toLowerCase() === 'e' && !editing) toggleEditor();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveScript(); }
  });

  window.addEventListener('beforeunload', () => persist());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  elements.title.value = state.draft.title;
  elements.text.value = state.draft.text;
  updatePrompt();
  applySettings();
  renderLibrary();
})();
