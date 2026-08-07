---
title: "Game Tracking Domain Architecture"
type: "domain"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#domain/games"
  - "#domain/tracking"
relations:
  depends_on:
    - "[[architecture-overview]]"
    - "[[backend-pocketbase]]"
  relates_to:
    - "[[gtd-game-domain]]"
---

# 🕹️ Game Tracking Domain Architecture

> **Graph Summary**: High-level domain structure governing game modules (`ae`, `mm2`, `gtd`), modular sub-pages, inventory tracking, script fetching, and market automation integrations.

---

## 🔗 Related Graph Nodes
- Parent MOC: [[000_INDEX]]
- Shell Integration: [[routing-and-shell]]
- Specialized GTD Sub-Domain: [[gtd-game-domain]]

---

## 🎲 Sub-Domain Modules

### 1. Anime Evolution (`ae`)
- **Location**: [src/games/ae](file:///c:/Users/shink/Documents/kirayu-tracker/src/games/ae)
- **Sub-pages**: Accounts, Units, Eldorado market integration, ZeusX market integration, Autoswap automation, Processed transactions.
- **Action Buttons**: `AeGetScriptButton` (generates Roblox executor scripts).

### 2. Murder Mystery 2 (`mm2`)
- **Location**: [src/games/mm2](file:///c:/Users/shink/Documents/kirayu-tracker/src/games/mm2)
- **Sub-pages**: Accounts, Items / Godlies inventory.
- **Action Buttons**: `Mm2GetScriptButton`.

### 3. Go Fishing 3D (`gtd`)
- **Location**: [src/games/gtd](file:///c:/Users/shink/Documents/kirayu-tracker/src/games/gtd)
- **Sub-pages**: Accounts, Inventory, Automation.
- **Header Chips**: Real-time total accounts, online account count, total seeds, daily seed gains (`GtdHeaderStats`).

---

## 🛠 Source Code References
- Game Modules Directory: [src/games/](file:///c:/Users/shink/Documents/kirayu-tracker/src/games)
- Game Navigation Tabs: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L125-L143)
