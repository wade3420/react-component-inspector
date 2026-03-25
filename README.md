# React Component Inspector for AI

Click any React element to inspect its component tree and copy AI-friendly context for Claude Code, Cursor, and other AI coding assistants.

**No project setup required.** Just install the extension and start inspecting.

## Features

- Hover to highlight React elements
- Click to see full component tree (parent to child)
- One-click copy in AI-friendly format
- Dark theme overlay panel
- Zero project code changes needed
- Works with React 17, 18, 19 (including Next.js App Router)
- Filters out framework internals (Next.js, React Router, etc.)

## Install

### Chrome Web Store
Coming soon.

### Manual (Developer Mode)
1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

## Usage

1. Run your React dev server
2. Click the extension icon in Chrome toolbar (green "ON" badge appears)
3. Hover over page elements (blue highlight)
4. Click an element to open the inspector panel
5. Click **Copy** to copy to clipboard
6. Paste into Claude Code / Cursor / any AI assistant and add your request

## Copy Format

```
Component: GlobalLayout > LocalMarketLayout > ProductInfo
File: ProductInfo.tsx
```

Then just add your request after pasting:
```
Component: GlobalLayout > LocalMarketLayout > ProductInfo
File: ProductInfo.tsx
Change the price font size to 18px
```

## How It Works

Uses React's internal Fiber tree (via `__reactFiber$` DOM properties) to map DOM elements to their React component hierarchy. Runs a page-level script in the MAIN world to access React internals, and a content script for the UI overlay.

## Requirements

- Chrome browser (Manifest V3)
- React app running in development mode

## Limitations

- File paths are inferred from component names (React 19 removed `_debugSource`)
- React Server Components may not be inspectable
- Production builds have limited component name info

## License

MIT
