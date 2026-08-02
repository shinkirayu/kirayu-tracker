import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { SkeletonGrid } from "../../components/Skeletons";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const ItemsPage = lazy(() => import("./pages/ItemsPage"));

export default function Mm2Home() {
  return (
    <Suspense fallback={<SkeletonGrid count={6} />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/account/:userId" element={<AccountPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </Suspense>
  );
}
