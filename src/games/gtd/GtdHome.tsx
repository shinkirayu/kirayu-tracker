import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import "./farm-theme.css";

const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const AutomationPage = lazy(() => import("./pages/AutomationPage"));

export default function GtdHome() {
  return (
    <Suspense fallback={<div className="panel" style={{ padding: 20 }}>Loading tracker…</div>}>
      <Routes>
        <Route path="/" element={<AccountsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="*" element={<AccountsPage />} />
      </Routes>
    </Suspense>
  );
}
