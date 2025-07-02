# QuickGPT

A macOS menu bar app for quick access to various LLMs (ChatGPT, Google Gemini, Anthropic Claude).

## Features

### Core Features
- 🧠 **LLM Interface Tabs**
  - Webview/tab for ChatGPT
  - Webview/tab for Google Gemini
  - Webview/tab for Anthropic Claude
  - Quick switcher to toggle between LLMs instantly
  - Open in browser button for each LLM

- 🎛️ **UI/UX Behavior**
  - App sits in macOS menu bar, not dock
  - Window auto-positions under tray icon
  - Click toggles window (show/hide)
  - Closes on blur (click outside closes window)
  - Smooth fade in/out animation

- ⚙️ **Preferences**
  - Set default LLM tab to open
  - Toggle auto-launch at login
  - Set hotkey to open app (e.g. Ctrl+Space)
  - Dark mode toggle / follow system
  - Update tray icon (light/dark)

- 🧪 **Power Features**
  - Keyboard shortcuts to switch between LLMs (Cmd/Ctrl + 1/2/3)
  - Resizable window with remember size
  - Lightweight local settings storage (via electron-store)

## Installation

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Development Setup
1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run in development mode:
   ```
   npm run dev
   ```

### Building for Production
```
npm run build
```

This will create a distributable app in the `dist` folder.

## Usage

- Click the menu bar icon to toggle the app window
- Use tabs to switch between different LLM interfaces
- Use keyboard shortcuts (Cmd/Ctrl + 1/2/3) to quickly switch between LLMs
- Use the global hotkey (default: Cmd/Ctrl+Shift+Space) to open the app from anywhere
- Access preferences by clicking the ⚙️ tab or right-clicking the tray icon

## Customization

### Tray Icons
Replace the placeholder icon files in `src/assets/` with your own:
- `tray-icon-light.png` - For light mode (visible on dark backgrounds)
- `tray-icon-dark.png` - For dark mode (visible on light backgrounds)

Icons should be 22x22 pixels for optimal display in the macOS menu bar.

## License

MIT 