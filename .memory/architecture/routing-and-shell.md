---
title: "Routing & Shell Theme Engine"
type: "architecture"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#arch/shell"
  - "#arch/routing"
relations:
  depends_on:
    - "[[architecture-overview]]"
  relates_to:
    - "[[game-tracking-domain]]"
    - "[[gtd-game-domain]]"
---

# 🚥 Routing & Shell Theme Engine

> **Graph Summary**: Details how Kirayu Tracker manages dynamic sub-routes, sidebar persistence, active game detection, and theme isolated shell headers.

---

## 🔗 Related Graph Nodes
- Parent Architecture Node: [[architecture-overview]]
- Domain Integration: [[game-tracking-domain]]
- Specific Game Theme: [[gtd-game-domain]]

---

## 🎯 Active Game Route Detection (`useActiveGame`)
Active game context is derived directly from `useLocation()` using regular expressions:
```typescript
function useActiveGame(): GameId | null {
  const { pathname } = useLocation();
  const match = /^\/(ae|mm2|gtd)(\/|$)/.exec(pathname);
  return (match?.[1] as GameId | undefined) ?? null;
}
```
When `activeGame` changes, `<Shell>` dynamically sets `data-shell-theme={activeGame}` and injects `.gtd-theme` CSS class overrides when applicable.

---

## 📌 Sidebar State Persistence (`useSidebarOpen`)
- Sidebar toggle state is stored in `localStorage` under key `"kirayu-sidebar"`.
- Smooth slide animations are achieved with fixed width CSS transitions (`w-[72px]` vs `w-0`).

---

## 🎨 Theme Nav Tabs (`NavItem`)
Game tabs adapt dynamically based on the game config `GAME_TABS[id]`:
- **GTD Tabs**: Pill styles with custom color themes (`green`, `blue`, `violet`, `yellow`).
- **AE / MM2 Tabs**: Standard rounded shell tabs with subtle hover animations.

---

## 🛠 Source Code References
- Route Detection & Hook: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L45-L50)
- Sidebar Toggle Hook: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L52-L75)
- Game Tabs Configuration: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L125-L143)
