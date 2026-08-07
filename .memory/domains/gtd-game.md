---
title: "GTD (Go Fishing 3D) Domain"
type: "domain"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#domain/gtd"
  - "#tech/react"
relations:
  depends_on:
    - "[[game-tracking-domain]]"
  relates_to:
    - "[[routing-and-shell]]"
---

# 🎣 GTD (Go Fishing 3D) Domain

> **Graph Summary**: Detailed domain specs for Go Fishing 3D tracking including seed calculations, online status metrics, theme pills, and header chips.

---

## 🔗 Related Graph Nodes
- Parent Domain: [[game-tracking-domain]]
- Navigation & Theme: [[routing-and-shell]]

---

## 📊 Header Stat Chips (`GtdHeaderStats`)
GTD features dedicated real-time header metrics rendered via `StatChip` components:

```tsx
<StatChip icon="👥" iconClass="blue" value={formatNumber(stats.total)} label="Accounts" />
<StatChip icon="🟢" iconClass="green" value={formatNumber(stats.online)} label="Online Now" />
<StatChip icon={<img src={GTD_SEEDS_ICON} />} iconClass="yellow" value={formatNumber(stats.totalSeeds)} label="Total Seeds" />
<StatChip icon={<img src={GTD_SEEDS_ICON} />} iconClass="yellow" value={formatSigned(stats.totalSeedsToday)} label="Seeds Today" />
```

---

## 🎨 Distinct Color System (`NavColor`)
GTD uses a dedicated color theme system (`.gtd-theme` CSS root class):
- **Green**: Accounts page (`/gtd`)
- **Blue**: Inventory page (`/gtd/inventory`)
- **Violet**: Automation page (`/gtd/automation`)

---

## 🛠 Source Code References
- Header Stats Component: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L21-L37)
- GTD Stats Hook: [useGtdDashboardStats.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/games/gtd/hooks/useGtdDashboardStats.ts)
- Number Formatting: [format.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/games/gtd/lib/format.ts)
