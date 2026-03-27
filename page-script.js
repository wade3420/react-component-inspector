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

  // ─── Props extraction ───

  function extractProps(fiber) {
    if (!fiber.memoizedProps) return null;
    try {
      const props = {};
      const raw = fiber.memoizedProps;
      // Get own enumerable keys safely (avoid Promise-based params/searchParams)
      const keys = Object.keys(raw);
      for (const key of keys) {
        if (key === 'children') continue;
        try {
          const val = raw[key];
          if (typeof val === 'function') { props[key] = '() => ...'; continue; }
          if (val instanceof Promise) { props[key] = '[Promise]'; continue; }
          if (typeof val === 'object' && val !== null) {
            try { props[key] = JSON.stringify(val).slice(0, 80); } catch { props[key] = '[Object]'; }
            continue;
          }
          props[key] = val;
        } catch { /* skip inaccessible props */ }
      }
      return Object.keys(props).length > 0 ? props : null;
    } catch { return null; }
  }

  // ─── Chunk URL path resolution ───

  const resolvedPaths = new Map();

  // Parse Turbopack chunk URLs to extract file paths
  // e.g. "apps_wello_src_app_local-market_products_%5BproductNumber%5D_page_tsx_0c2hph3._.js"
  // → "src/app/local-market/products/[productNumber]/page.tsx"
  function parseChunkUrl(url) {
    const filename = url.split('/').pop() || '';
    // Strip prefix: apps_wello_ or turbopack-apps_wello_
    const prefixMatch = filename.match(/^(?:turbopack-)?apps_\w+_(src_.+)/);
    if (!prefixMatch) return null;
    let rest = prefixMatch[1];

    // Strip suffix: _<hash>._.js or _<hash>._.css
    rest = rest.replace(/\.[_.]\.(?:js|css)$/, '');

    // Find the last _tsx, _ts, _jsx, _js to split path from extension
    const extMatch = rest.match(/^(.+)_(tsx|ts|jsx|js|css|scss)_[0-9a-z~-]+$/);
    if (!extMatch) return null;

    let path = extMatch[1];
    const ext = extMatch[2];

    // Replace _ with / for path separators
    path = path.replace(/_/g, '/');
    // Decode percent-encoded chars
    path = decodeURIComponent(path);

    return `${path}.${ext}`;
  }

  // Get the current page route from chunk URLs
  function getCurrentRoute() {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const chunkUrls = scripts.map(s => s.src).filter(u => u.includes('/_next/static/chunks/'));

    for (const url of chunkUrls) {
      const parsed = parseChunkUrl(url);
      if (!parsed) continue;
      // Find page chunk (ends with page.tsx)
      if (parsed.endsWith('/page.tsx') || parsed.endsWith('/page.ts')) {
        // Return the directory: src/app/local-market/products/[productNumber]/
        return parsed.replace(/page\.tsx?$/, '');
      }
    }
    return null;
  }

  let cachedRoute = null;

  function resolveFromChunkUrls(name) {
    if (resolvedPaths.has(name)) return resolvedPaths.get(name);

    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const chunkUrls = scripts.map(s => s.src).filter(u => u.includes('/_next/static/chunks/'));
    const fileName = inferFileName(name);

    // 1. Direct match: component has its own chunk
    for (const url of chunkUrls) {
      const parsed = parseChunkUrl(url);
      if (!parsed) continue;
      const pathFile = parsed.split('/').pop();
      if (pathFile === fileName || pathFile?.includes(name)) {
        resolvedPaths.set(name, parsed);
        return parsed;
      }
    }

    // 2. Route-based inference: use page chunk to determine directory
    if (!cachedRoute) cachedRoute = getCurrentRoute();

    if (cachedRoute) {
      // Next.js convention: components in _components/ subdirectory
      const guessedPath = `${cachedRoute}_components/${fileName}`;
      resolvedPaths.set(name, guessedPath);
      return guessedPath;
    }

    resolvedPaths.set(name, null);
    return null;
  }

  function resolveSourcePath(fiber) {
    const name = fiber.type?.displayName || fiber.type?.name || '';

    // Debug: log chunk URL parsing
    if (!resolvedPaths.has('__debug_done__')) {
      resolvedPaths.set('__debug_done__', true);
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const chunks = scripts.map(s => s.src).filter(u => u.includes('/_next/static/chunks/'));
      console.log('[RCI] total chunks:', chunks.length);
      chunks.forEach(u => {
        const parsed = parseChunkUrl(u);
        if (parsed) console.log('[RCI] parsed:', u.split('/').pop(), '→', parsed);
      });
      console.log('[RCI] route:', getCurrentRoute());
    }

    return resolveFromChunkUrls(name);
  }

  // ─── Component tree ───

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
            props: extractProps(current),
            _fiber: current, // keep ref for async resolve
          });
        }
      }
      current = current.return;
    }
    return tree;
  }

  function resolveTree(tree) {
    return tree.map((item) => ({
      name: item.name,
      fileName: item.fileName,
      sourcePath: resolveSourcePath(item._fiber) || null,
      props: item.props,
    }));
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
      // Capture element HTML (truncated)
      let elementHtml = '';
      if (el) {
        try {
          const html = el.outerHTML;
          if (html.length > 500) {
            // Keep opening tag + truncated inner
            const tagEnd = html.indexOf('>') + 1;
            const closingTag = html.slice(html.lastIndexOf('</'));
            elementHtml = html.slice(0, Math.min(460 - closingTag.length, html.length)) + '...' + closingTag;
          } else {
            elementHtml = html;
          }
        } catch { /* skip */ }
      }
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

      const resolvedTree = resolveTree(tree);
      window.postMessage({
        source: RCI_ID,
        type: 'RCI_INSPECT_RESULT',
        payload: { success: true, tree: resolvedTree, elementHtml, resolving: false },
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

  // Reset caches on route change (SPA navigation)
  let lastPath = location.pathname;
  const observer = new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      cachedRoute = null;
      resolvedPaths.clear();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.postMessage({
    source: RCI_ID,
    type: 'RCI_PAGE_SCRIPT_READY',
  });
})();
