<div align="center">

# React Component Inspector for AI

**Click any React element. See its component tree. Copy for AI.**

The missing bridge between your browser and AI coding assistants.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/wade3420/react-component-inspector)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![React 17-19](https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## The Problem

You're staring at a React app in the browser. You want to tell Claude Code or Cursor: *"change the font size of this component."* But first you need to figure out:

- What component is this?
- What's the file name?
- Where does it sit in the component tree?

You open React DevTools, dig through the fiber tree, mentally map it back to your source code, then type it all out manually.

**React Component Inspector for AI does this in one click.**

## How It Works

```
Click extension icon (ON) → Hover elements (highlight) → Click (panel) → Copy → Paste into AI
```

1. **Toggle** — Click the extension icon. Green badge = active.
2. **Hover** — Move your mouse over any element. Blue highlight shows React boundaries.
3. **Click** — Click an element. Panel appears with the full component tree.
4. **Copy** — One button. AI-ready format in your clipboard.
5. **Paste** — Drop it into Claude Code, Cursor, Copilot, or any AI assistant. Add your request.

## What You Get

```
Component: GlobalLayout > LocalMarketLayout > ProductInfo
File: ProductInfo.tsx
```

Paste it and just add what you want:

```
Component: GlobalLayout > LocalMarketLayout > ProductInfo
File: ProductInfo.tsx
Change the price display font size to 18px and make it bold
```

Your AI assistant immediately knows which component to modify. No guessing, no searching.

## Features

| Feature | Description |
|---------|-------------|
| **One-click inspect** | Click any element to see its React component hierarchy |
| **Component tree** | Full parent-to-child tree, not just the nearest component |
| **AI-optimized copy** | Output format designed for Claude Code, Cursor, and other AI assistants |
| **Smart filtering** | Automatically hides React/Next.js internals (60+ filtered patterns) |
| **File name inference** | Derives likely file names from component names |
| **Hover highlight** | Blue overlay shows element boundaries before clicking |
| **Dark theme panel** | Clean, minimal overlay that doesn't fight your app's UI |
| **Zero config** | No npm install, no babel plugin, no project changes. Just the extension. |

## Compatibility

| Environment | Support |
|-------------|---------|
| React 17 | Supported |
| React 18 | Supported |
| React 19 (canary) | Supported |
| Next.js App Router | Supported |
| Next.js Pages Router | Supported |
| Vite + React | Supported |
| Create React App | Supported |
| Turbopack | Supported |
| SWC (no Babel) | Supported |

## Install

### Chrome Web Store

Coming soon.

### Manual Install (Developer Mode)

```bash
git clone https://github.com/wade3420/react-component-inspector.git
```

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the cloned folder
5. Pin the extension in your toolbar

## Architecture

```
Chrome Extension (Manifest V3)
│
├── background.js          # Service worker — toggle state per tab
│
├── page-script.js         # Injected into MAIN world
│   ├── Access __reactFiber$ on DOM elements
│   ├── Walk fiber tree → build component hierarchy
│   ├── Filter 60+ internal component patterns
│   └── Communicate via window.postMessage
│
├── content-script.js      # Isolated world
│   ├── Hover highlight overlay (position: fixed)
│   ├── Inspector panel UI (dark theme)
│   ├── Clipboard copy (navigator.clipboard)
│   └── Relay messages between page-script ↔ background
│
└── panel.css              # Catppuccin-inspired dark theme
```

### Why Two Scripts?

Chrome extension content scripts run in an **isolated JavaScript environment**. They share the DOM but cannot access JavaScript properties that React attaches to elements (`__reactFiber$`, `__reactInternalInstance$`).

The solution: `page-script.js` runs in the **MAIN world** (same as the page), where it can read React's fiber tree. It communicates with `content-script.js` via `window.postMessage`.

### Component Filtering

The extension filters 60+ internal component names from React, Next.js, and common libraries:

- React internals: `Fragment`, `Suspense`, `Root`, etc.
- Next.js App Router: `InnerLayoutRouter`, `SegmentViewNode`, `ErrorBoundary`, etc.
- Pattern-based: `*Boundary`, `*Provider`, `__next_*`
- Heuristic: lowercase-start names, single-letter names

Only your application's components appear in the tree.

### File Name Resolution

React 19 [removed `_debugSource`](https://github.com/facebook/react/issues/32574) from fiber nodes, making it impossible to get source file paths at runtime without build-time integration.

This extension uses **component name inference** as a practical workaround:

| Component Name | Inferred File |
|---------------|---------------|
| `ProductInfo` | `ProductInfo.tsx` |
| `Layout` | `layout.tsx` (Next.js convention) |
| `Page` | `page.tsx` |
| `Loading` | `loading.tsx` |

For exact file paths with line numbers, consider [React Grab](https://github.com/aidenybai/react-grab) (requires npm install in your project).

## Comparison

| Tool | Type | AI-Optimized | React 19 | Project Changes | File Paths |
|------|------|:---:|:---:|:---:|:---:|
| **This extension** | Chrome Extension | Yes | Yes | None | Inferred |
| React Grab | npm package | Yes | Yes | 1 line in layout | Exact |
| LocatorJS | Extension + Babel | No | Yes | Babel plugin | Exact |
| React Click To Component | Chrome Extension | No | Broken | None | N/A |
| React Inspector | Chrome Extension | No | Broken | None | N/A |
| React DevTools | Chrome Extension | No | Yes | None | None |

## Limitations

- **File paths are inferred**, not exact (React 19 limitation — see [Architecture](#file-name-resolution))
- **Server Components** rendered on the server may not have fiber nodes in the client
- **Production builds** minify component names — use development mode
- **Chrome only** — Manifest V3 (Firefox support not planned)

## Contributing

PRs welcome. Key areas for contribution:

- [ ] Source map parsing for exact file paths
- [ ] Keyboard shortcut support (Alt+Shift+C)
- [ ] Multiple element selection
- [ ] Firefox port
- [ ] Component props/state display

## License

MIT
