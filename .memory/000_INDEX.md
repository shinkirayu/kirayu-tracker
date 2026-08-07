---
title: "000 Index (Root Map of Content)"
type: "moc"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#type/moc"
  - "#kirayu-tracker"
relations:
  relates_to:
    - "[[architecture-overview]]"
    - "[[routing-and-shell]]"
    - "[[game-tracking-domain]]"
    - "[[gtd-game-domain]]"
    - "[[frontend-stack]]"
    - "[[backend-pocketbase]]"
    - "[[relationship-matrix]]"
---

# 🧠 Kirayu Tracker Memory Graph Index (MOC)

> **Graph Summary**: Root Map of Content (MOC) serving as the main entry point to the `.memory/` knowledge graph for the **Kirayu Tracker** project.

---

## 🗺️ Knowledge Graph Map of Content

### 🏗️ Architecture & Shell
- [[architecture-overview]] — High-level React 19 + PocketBase app layout, Gate authentication & provider hierarchy.
- [[routing-and-shell]] — Dynamic game tabs, sidebar toggle persistence, and game-specific theme engine.

### 🎮 Domains & Games
- [[game-tracking-domain]] — Multi-game tracking architecture supporting `ae`, `mm2`, and `gtd`.
- [[gtd-game-domain]] — Go Fishing 3D (`gtd`) seed tracking, online status, inventory & automation module.

### ⚙️ Tech Stack & Infrastructure
- [[frontend-stack]] — React 19, Vite, TanStack React Query v5, Tailwind CSS v4, Oxlint setup.
- [[backend-pocketbase]] — PocketBase authentication store (`pb`), user session management, script generation.

### 📜 Architecture Decisions (ADRs)
- [[0001-multi-game-shell]] — ADR: Unified multi-game shell with theme isolation and lazy loading.

### 📊 Graphify Graph Matrix
- [[relationship-matrix]] — Full node & edge relationship matrix mapping imports, dependencies, and calls.

---

## 🔗 Quick Codebase References
- App Entry: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx)
- Main Component Mount: [main.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/main.tsx)
- PocketBase Client: [pocketbase.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/lib/pocketbase.ts)
- Project Config: [package.json](file:///c:/Users/shink/Documents/kirayu-tracker/package.json)
