# System Monitor Chrome Extension

A lightweight Manifest V3 Chrome extension popup for system metrics. The first version renders only when the toolbar popup opens and uses mock data by default outside Chrome.

## Install

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install
```

## Development

```bash
pnpm build
pnpm test
```

Open `src/popup.html` directly for quick mock-data UI checks, or load the built `dist` folder in Chrome for extension APIs.

## Build

```bash
pnpm build
```

The build output is written to `dist`.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `dist` folder.
5. Click the System Monitor toolbar icon.

## Limitations

Chrome extension APIs expose CPU, memory, storage, and display metadata with limited detail. They do not expose reliable raw network throughput, CPU temperature, fan speed, SSD temperature, or SSD read/write throughput. Those values are shown as `unsupported` or `N/A` unless a future version adds a real Native Messaging host or local companion agent.

This first version intentionally does not use Native Messaging and does not inject a floating overlay into webpages.
