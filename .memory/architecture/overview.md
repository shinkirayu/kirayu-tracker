---
title: "Architecture Overview"
type: "architecture"
created: 2026-08-07
updated: 2026-08-07
tags:
  - "#arch/overview"
  - "#tech/react"
relations:
  depends_on:
    - "[[frontend-stack]]"
    - "[[backend-pocketbase]]"
  relates_to:
    - "[[routing-and-shell]]"
    - "[[game-tracking-domain]]"
  implements:
    - "[[000_INDEX]]"
---

# 🏗️ Architecture Overview

> **Graph Summary**: High-level system architecture of **Kirayu Tracker**, detailing authentication gating, state management providers, lazy loading, and core shell integration.

---

## 🔗 Related Graph Nodes
- Parent MOC: [[000_INDEX]]
- Child Component Node: [[routing-and-shell]]
- Dependency: [[backend-pocketbase]]

---

## 🏛️ Application Architecture & Provider Hierarchy

The application wraps the entire client inside a single React tree initialized in [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx):

```
[ App ]
 └── <ErrorBoundary>
      └── <QueryClientProvider> (TanStack React Query v5)
           └── <ToastProvider>
                └── <BrowserRouter>
                     └── <Gate>
                          ├── (If Unauthenticated) -> <LoginPage> (Lazy)
                          └── (If Authenticated)   -> <Shell>
                                                       ├── <Sidebar>
                                                       ├── <Header> (With GameTabs & Script Buttons)
                                                       └── <Routes> (Home, AE, MM2, GTD)
```

---

## 🔑 Authentication Gating (`Gate`)
- The `<Gate>` component uses `useSession()` ([useAuth.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/hooks/useAuth.ts)) to observe `pb.authStore`.
- While checking session loading state, a `<SkeletonGrid count={6} />` is rendered.
- If no session exists, the user is rendered the lazy-loaded `<LoginPage />`.

---

## 🛠 Source Code References
- Root App Component: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L291-L304)
- Gate Guard: [App.tsx](file:///c:/Users/shink/Documents/kirayu-tracker/src/App.tsx#L258-L289)
- Query Client Setup: [queryClient.ts](file:///c:/Users/shink/Documents/kirayu-tracker/src/lib/queryClient.ts)
