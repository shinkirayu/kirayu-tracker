import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { EldoradoQueueProvider } from "./lib/eldoradoQueue";
import { SkeletonGrid } from "../../components/Skeletons";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const UnitsPage = lazy(() => import("./pages/UnitsPage"));
const EldoradoPage = lazy(() => import("./pages/EldoradoPage"));
const ZeusXPage = lazy(() => import("./pages/ZeusXPage"));
const AutoswapPage = lazy(() => import("./pages/AutoswapPage"));
const ProcessedAccountsPage = lazy(() => import("./pages/ProcessedAccountsPage"));

export default function AeHome() {
  return (
    <EldoradoQueueProvider>
      <Suspense fallback={<SkeletonGrid count={6} />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/account/:userId" element={<AccountPage />} />
          <Route path="/units" element={<UnitsPage />} />
          <Route path="/eldorado" element={<EldoradoPage />} />
          <Route path="/zeusx" element={<ZeusXPage />} />
          <Route path="/autoswap" element={<AutoswapPage />} />
          <Route path="/processed" element={<ProcessedAccountsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </Suspense>
    </EldoradoQueueProvider>
  );
}
