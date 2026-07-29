import { Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import AccountPage from "./pages/AccountPage";
import ItemsPage from "./pages/ItemsPage";

export default function Mm2Home() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/account/:userId" element={<AccountPage />} />
      <Route path="/items" element={<ItemsPage />} />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  );
}
