---
title: "Backend & PocketBase Integration"
type: "tech"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#tech/pocketbase"
  - "#tech/auth"
relations:
  depends_on:
    - "[[000_INDEX]]"
  relates_to:
    - "[[architecture-overview]]"
    - "[[game-tracking-domain]]"
---

# 📦 Backend & PocketBase Integration

> **Graph Summary**: Outlines PocketBase client initialization, auth store management, game metadata definitions, and authentication session state.

---

## 🔗 Related Graph Nodes
- Parent MOC: [[000_INDEX]]
- System Architecture: [[architecture-overview]]
- Domain Usage: [[game-tracking-domain]]

---

## 🔌 PocketBase Client ([pocketbase.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/lib/pocketbase.ts))

PocketBase is configured via environment variables:
```typescript
import PocketBase from 'pocketbase';

export const POCKETBASE_URL =
  import.meta.env.VITE_POCKETBASE_URL || "https://pb.kirayu.app";

export const pb = new PocketBase(POCKETBASE_URL);
```

---

## 🎮 Game Definitions & Feature Toggles
The PocketBase module defines supported games (`GameId = "ae" | "mm2" | "gtd"`):

| Game Key | Label | Enabled Flag | Icon / Path |
| :--- | :--- | :--- | :--- |
| `ae` | Anime Evolution | `true` | `/game-icons/ae.png` |
| `mm2` | Murder Mystery 2 | `true` | `/game-icons/mm2.png` |
| `gtd` | Go Fishing 3D | `true` | `/game-icons/gtd.png` |

---

## 🔐 Auth Store & Session Lifecycle
- `useSession()` hook subscribes to `pb.authStore.onChange(...)` to reactively trigger React re-renders upon login or logout.
- Sign out is executed synchronously via `pb.authStore.clear()`.

---

## 🛠 Source Code References
- PocketBase Singleton & Metadata: [pocketbase.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/lib/pocketbase.ts)
- Session Hook: [useAuth.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/hooks/useAuth.ts)
