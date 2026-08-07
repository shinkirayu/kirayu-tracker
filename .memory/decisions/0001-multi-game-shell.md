---
title: "ADR 0001: Unified Multi-Game Shell Architecture"
type: "adr"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#adr"
  - "#arch/shell"
relations:
  implements:
    - "[[architecture-overview]]"
  relates_to:
    - "[[routing-and-shell]]"
    - "[[game-tracking-domain]]"
---

# 📜 ADR 0001: Unified Multi-Game Shell Architecture

## Status
**ACCEPTED**

## Context
Kirayu Tracker needs to manage account automation, inventory, and script generation for multiple distinct Roblox games (`ae`, `mm2`, `gtd`). Each game has different UI requirements, sub-pages, action buttons, header stats, and color schemes.

## Decision
1. Implement a single top-level `<Shell>` component in [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx) that wraps all authenticated routes.
2. Dynamically set `data-shell-theme` and theme classes (`.gtd-theme`) based on the active URL prefix (`/ae/*`, `/mm2/*`, `/gtd/*`).
3. Lazy-load game home components (`AeHome`, `Mm2Home`, `GtdHome`) via React Suspense to minimize initial bundle size.
4. Render game-specific header controls (`AeGetScriptButton`, `Mm2GetScriptButton`, `GtdGetScriptButton`, `GtdHeaderStats`) based on active route context.

## Consequences
- **Positive**: Clean separation of game-specific logic while sharing authentication, sidebar navigation, toast notifications, and error boundary wrappers.
- **Positive**: Adding a new game requires only adding a key to `GAMES` and creating a directory in `src/games/`.
- **Negative**: Header height and layout must be carefully standard-sized to prevent visual shifts when toggling between games.

---

## 🛠 Source Code References
- Shell Implementation: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L208-L256)
