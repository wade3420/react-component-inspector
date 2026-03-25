(() => {
  const RCI_ID = '__rci__';
  let isActive = false;
  let pageScriptReady = false;
  let highlightOverlay = null;
  let panel = null;
  let warningEl = null;
  let selectedTreeIndex = -1;
  let currentTree = [];

  // ─── DOM Setup ───

  function createOverlayElements() {
    if (highlightOverlay) return;

    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'rci-highlight-overlay';
    document.body.appendChild(highlightOverlay);

    panel = document.createElement('div');
    panel.id = 'rci-panel';
    panel.innerHTML = `
      <div id="rci-panel-header">
        <span id="rci-panel-title">React Inspector</span>
        <button id="rci-panel-close">&times;</button>
      </div>
      <div id="rci-tree-section"></div>
      <div id="rci-action-section">
        <button id="rci-copy-btn">복사</button>
      </div>
    `;
    document.body.appendChild(panel);

    warningEl = document.createElement('div');
    warningEl.id = 'rci-warning';
    document.body.appendChild(warningEl);

    panel.querySelector('#rci-panel-close').addEventListener('click', closePanel);
    panel.querySelector('#rci-copy-btn').addEventListener('click', copyToClipboard);

    document.addEventListener('click', (e) => {
      if (panel.style.display === 'block' && !panel.contains(e.target) && isActive) {
        closePanel();
      }
    }, true);
  }

  // ─── Communication with page-script.js (MAIN world) ───

  function sendToPage(type, payload) {
    window.postMessage({ source: RCI_ID, type, payload }, '*');
  }

  // ─── Panel Rendering ───

  function renderTree(tree, selectedIndex) {
    const section = panel.querySelector('#rci-tree-section');
    section.innerHTML = '';

    tree.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'rci-tree-item' + (i === selectedIndex ? ' selected' : '');

      const indent = '<span class="rci-tree-indent">' + '  '.repeat(i) + (i > 0 ? '> ' : '') + '</span>';
      const path = item.sourcePath || item.fileName;
      const fileHint = path ? ` <span style="color:#585B70;font-size:11px">(${path})</span>` : '';
      el.innerHTML = indent + item.name + fileHint;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedTreeIndex = i;
        renderTree(tree, i);
      });

      section.appendChild(el);
    });
  }

  function positionPanel(x, y) {
    panel.style.display = 'block';
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x + 12;
    let top = y + 12;

    if (left + rect.width > vw - 16) left = x - rect.width - 12;
    if (top + rect.height > vh - 16) top = y - rect.height - 12;
    if (left < 16) left = 16;
    if (top < 16) top = 16;

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function showPanel(tree, clickX, clickY) {
    if (tree.length === 0) return;

    currentTree = tree;
    selectedTreeIndex = tree.length - 1;

    renderTree(tree, selectedTreeIndex);
    positionPanel(clickX, clickY);
  }

  function closePanel() {
    if (panel) panel.style.display = 'none';
  }

  // ─── Clipboard ───

  function copyToClipboard() {
    if (currentTree.length === 0) return;

    const treePath = currentTree.map((item) => item.name).join(' > ');
    const selected = currentTree[selectedTreeIndex];
    const filePath = selected.sourcePath || selected.fileName || `${selected.name}.tsx`;
    const text = `컴포넌트: ${treePath}\n파일: ${filePath}`;

    navigator.clipboard.writeText(text).then(() => {
      const btn = panel.querySelector('#rci-copy-btn');
      btn.textContent = '복사됨!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '복사';
        btn.classList.remove('copied');
      }, 1500);
    });
  }

  // ─── Highlight ───

  function showHighlight(rect) {
    highlightOverlay.style.display = 'block';
    highlightOverlay.style.left = rect.left + 'px';
    highlightOverlay.style.top = rect.top + 'px';
    highlightOverlay.style.width = rect.width + 'px';
    highlightOverlay.style.height = rect.height + 'px';
  }

  function hideHighlight() {
    if (highlightOverlay) highlightOverlay.style.display = 'none';
  }

  // ─── Warning ───

  function showWarning(msg) {
    warningEl.textContent = msg;
    warningEl.style.display = 'block';
    setTimeout(() => {
      warningEl.style.display = 'none';
    }, 3000);
  }

  // ─── Event Handlers ───

  let hoverThrottleTimer = null;

  function onMouseMove(e) {
    if (!isActive || (panel && panel.style.display === 'block')) return;
    if (e.target?.id?.startsWith('rci-')) return;

    if (hoverThrottleTimer) return;
    hoverThrottleTimer = setTimeout(() => { hoverThrottleTimer = null; }, 50);

    sendToPage('RCI_HOVER_ELEMENT', { x: e.clientX, y: e.clientY });
  }

  function onMouseClick(e) {
    if (!isActive) return;
    if (e.target?.id?.startsWith('rci-') || panel?.contains(e.target)) return;
    if (panel && panel.style.display === 'block') return;

    e.preventDefault();
    e.stopPropagation();
    hideHighlight();

    sendToPage('RCI_INSPECT_ELEMENT', { x: e.clientX, y: e.clientY });
    // Store click position for panel placement
    panel._pendingClick = { x: e.clientX, y: e.clientY };
  }

  // ─── Messages from page-script.js ───

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== RCI_ID) return;

    const { type, payload } = e.data;

    if (type === 'RCI_PAGE_SCRIPT_READY') {
      pageScriptReady = true;
    }

    if (type === 'RCI_REACT_STATUS') {
      if (!payload.available) {
        showWarning('React Fiber를 감지할 수 없습니다. React 개발 모드인지 확인해주세요.');
      }
    }

    if (type === 'RCI_HOVER_RESULT') {
      if (payload.found) {
        showHighlight(payload.rect);
      } else {
        hideHighlight();
      }
    }

    if (type === 'RCI_INSPECT_RESULT') {
      if (!payload.success) {
        const msg = payload.reason === 'no_fiber'
          ? '이 요소에서 React 컴포넌트를 찾을 수 없습니다'
          : '요소를 찾을 수 없습니다';
        showWarning(msg);
        return;
      }

      if (payload.tree.length === 0) {
        showWarning('컴포넌트 트리를 구성할 수 없습니다');
        return;
      }

      const click = panel._pendingClick || { x: 200, y: 200 };
      showPanel(payload.tree, click.x, click.y);
    }
  });

  // ─── Activation ───

  function activate() {
    isActive = true;
    createOverlayElements();
    sendToPage('RCI_CHECK_REACT', {});
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onMouseClick, true);
  }

  function deactivate() {
    isActive = false;
    hideHighlight();
    closePanel();
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onMouseClick, true);
  }

  // ─── Chrome Extension Message Listener ───

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_INSPECT') {
      if (msg.active) {
        activate();
      } else {
        deactivate();
      }
    }
  });
})();
