import { Routes, Route } from "react-router-dom";
import "./farm-theme.css";
import AccountsPage from "./pages/AccountsPage";
import InventoryPage from "./pages/InventoryPage";
import AutomationPage from "./pages/AutomationPage";

export default function GtdHome() {
  return (
    <div className="gtd-theme">
      <Routes>
        <Route path="/" element={<AccountsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="*" element={<AccountsPage />} />
      </Routes>
    </div>
  );
}
