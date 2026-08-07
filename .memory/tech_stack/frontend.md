---
title: "Frontend Tech Stack"
type: "tech"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#tech/react"
  - "#tech/vite"
  - "#tech/tailwind"
relations:
  depends_on:
    - "[[000_INDEX]]"
  relates_to:
    - "[[architecture-overview]]"
---

# ⚡ Frontend Tech Stack

> **Graph Summary**: Specifications and versions of core frontend frameworks, bundlers, linters, and state management libraries powering Kirayu Tracker.

---

## 🔗 Related Graph Nodes
- Parent MOC: [[000_INDEX]]
- Architecture Overview: [[architecture-overview]]

---

## 🧰 Technology Specifications

| Library / Tool | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `^19.2.7` | UI library with Concurrent Mode, Lazy loading, Suspense |
| **TypeScript** | `~6.0.2` | Static typing across components, games, and API records |
| **Vite** | `^8.1.1` | Next-generation frontend tooling and HMR dev server |
| **TanStack React Query** | `^5.101.4` | Asynchronous data fetching, caching, and background revalidation |
| **Tailwind CSS** | `^4.3.3` | Utility-first CSS framework (integrated via `@tailwindcss/vite`) |
| **Oxlint** | `^1.71.0` | Ultra-fast Rust-based JS/TS linter enforcing React hooks & export rules |
| **React Router** | `^7.18.1` | Client-side routing for multi-game modules |

---

## ⚙️ Build & Lint Scripts
- `npm run dev`: Starts Vite dev server.
- `npm run build`: Type-checks with `tsc -b` and builds production bundle with `vite build`.
- `npm run lint`: Runs Oxlint linter across codebase.

---

## 🛠 Source Code References
- Package Manifest: [package.json](file:///c:/Users/shink/Documents/kirayu-tracker/package.json)
- Vite Config: [vite.config.ts](file:///c:/Users/shink/Documents/kirayu-tracker/vite.config.ts)
- Oxlint Rules: [.oxlintrc.json](file:///c:/Users/shink/Documents/kirayu-tracker/.oxlintrc.json)
