// Runs in MAIN world — can access React Fiber properties on DOM elements
(() => {
  const RCI_ID = '__rci__';

  // ─── Fiber Utilities ───

  function getFiberFromElement(element) {
    const fiberKey = Object.keys(element).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    return fiberKey ? element[fiberKey] : null;
  }

  // Next.js / React internal component names to filter out
  const INTERNAL_NAMES = new Set([
    // React internals
    'Anonymous', 'Fragment', 'Suspense', 'SuspenseList', 'Root',
    // Next.js App Router internals
    'ServerRoot', 'AppRouter', 'Router', 'RSCComponent',
    'InnerLayoutRouter', 'OuterLayoutRouter', 'LayoutRouter',
    'RenderFromTemplateContext', 'SegmentStateProvider',
    'ScrollAndFocusHandler', 'InnerScrollAndFocusHandler',
    'ScrollAndMaybeFocusHandler', 'InnerScrollAndFocusHandlerOld',
    'RedirectErrorBoundary', 'RedirectBoundary',
    'NotFoundErrorBoundary', 'NotFoundBoundary',
    'DevRootNotFoundBoundary', 'DevRootHTTPAccessFallbackBoundary',
    'HotReload', 'ReactDevOverlay',
    'ErrorBoundary', 'ErrorBoundaryHandler',
    'RootErrorBoundary', 'AppDevOverlayErrorBoundary',
    'AppRouterAnnouncer', 'SegmentViewNode', 'ViewNode',
    'ClientPageRoot', 'ClientSegmentRoot',
    'MetadataBoundary', 'MetadataOutlet',
    'HTTPAccessFallbackBoundary', 'HTTPAccessFallbackErrorBoundary',
    'HTTPAccessErrorBoundary',
    'LoadingBoundary',
    'RootLayout', 'Body', 'Head', 'DefaultLayout',
    'StaticGenerationSearchParamsBailoutProvider',
    'PathnameContextProviderAdapter',
  ]);

  // Patterns that indicate internal/framework components
  const INTERNAL_PATTERNS = [
    /^__next_/,       // __next_root_layout_boundary__ etc
    /Boundary$/,      // any *Boundary
    /Provider$/,      // any *Provider (QueryClientProvider, CookiesProvider, etc)
  ];

  function isUserComponent(name) {
    if (!name) return false;
    if (name.startsWith('_')) return false;
    if (INTERNAL_NAMES.has(name)) return false;
    if (name.length <= 2) return false;
    if (name[0] === name[0].toLowerCase()) return false;
    // Check patterns
    if (INTERNAL_PATTERNS.some(p => p.test(name))) return false;
    return true;
  }

  // Next.js App Router convention: special file names
  const NEXTJS_FILE_NAMES = {
    'Layout': 'layout.tsx',
    'Page': 'page.tsx',
    'Loading': 'loading.tsx',
    'NotFound': 'not-found.tsx',
    'Error': 'error.tsx',
    'Template': 'template.tsx',
  };

  function inferFileName(name) {
    // Check Next.js conventions first
    if (NEXTJS_FILE_NAMES[name]) return NEXTJS_FILE_NAMES[name];
    // Also check suffix patterns: LocalMarketLayout → layout.tsx
    for (const [suffix, file] of Object.entries(NEXTJS_FILE_NAMES)) {
      if (name.endsWith(suffix) && name !== suffix) return `${name}.tsx`;
    }
    return `${name}.tsx`;
  }

  function getComponentTree(fiber) {
    const tree = [];
    let current = fiber;
    while (current) {
      if (current.type && typeof current.type === 'function') {
        const name = current.type.displayName || current.type.name || '';
        if (isUserComponent(name)) {
          tree.unshift({
            name,
            fileName: inferFileName(name),
          });
        }
      }
      current = current.return;
    }
    return tree;
  }

  function hasReactFiber() {
    const testEl = document.querySelector('#__next')
      || document.querySelector('#root')
      || document.body?.firstElementChild;
    if (!testEl) return false;
    return Object.keys(testEl).some(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
  }

  // ─── Message Handler ───

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== RCI_ID) return;

    const { type, payload } = e.data;

    if (type === 'RCI_CHECK_REACT') {
      window.postMessage({
        source: RCI_ID,
        type: 'RCI_REACT_STATUS',
        payload: { available: hasReactFiber() },
      });
    }

    if (type === 'RCI_INSPECT_ELEMENT') {
      const el = document.elementFromPoint(payload.x, payload.y);
      if (!el) {
        window.postMessage({
          source: RCI_ID,
          type: 'RCI_INSPECT_RESULT',
          payload: { success: false, reason: 'no_element' },
        });
        return;
      }

      const fiber = getFiberFromElement(el);
      if (!fiber) {
        window.postMessage({
          source: RCI_ID,
          type: 'RCI_INSPECT_RESULT',
          payload: { success: false, reason: 'no_fiber' },
        });
        return;
      }

      const tree = getComponentTree(fiber);
      window.postMessage({
        source: RCI_ID,
        type: 'RCI_INSPECT_RESULT',
        payload: { success: true, tree },
      });
    }

    if (type === 'RCI_HOVER_ELEMENT') {
      const el = document.elementFromPoint(payload.x, payload.y);
      if (!el) {
        window.postMessage({
          source: RCI_ID,
          type: 'RCI_HOVER_RESULT',
          payload: { found: false },
        });
        return;
      }

      const fiber = getFiberFromElement(el);
      if (!fiber) {
        window.postMessage({
          source: RCI_ID,
          type: 'RCI_HOVER_RESULT',
          payload: { found: false },
        });
        return;
      }

      const rect = el.getBoundingClientRect();
      window.postMessage({
        source: RCI_ID,
        type: 'RCI_HOVER_RESULT',
        payload: {
          found: true,
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        },
      });
    }
  });

  window.postMessage({
    source: RCI_ID,
    type: 'RCI_PAGE_SCRIPT_READY',
  });
})();
