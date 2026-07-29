import { Routes, Route } from "react-router-dom";
import { EldoradoQueueProvider } from "./lib/eldoradoQueue";
import DashboardPage from "./pages/DashboardPage";
import AccountPage from "./pages/AccountPage";
import UnitsPage from "./pages/UnitsPage";
import EldoradoPage from "./pages/EldoradoPage";
import ZeusXPage from "./pages/ZeusXPage";
import AutoswapPage from "./pages/AutoswapPage";

export default function AeHome() {
  return (
    <EldoradoQueueProvider>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/account/:userId" element={<AccountPage />} />
        <Route path="/units" element={<UnitsPage />} />
        <Route path="/eldorado" element={<EldoradoPage />} />
        <Route path="/zeusx" element={<ZeusXPage />} />
        <Route path="/autoswap" element={<AutoswapPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </EldoradoQueueProvider>
  );
}
