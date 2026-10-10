import { lazy } from 'react';
import { createBrowserRouter, Navigate, useParams, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { OnboardingGate } from '@/components/layout/OnboardingGate';
import { RouteError } from '@/components/feedback/RouteError';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { config } from './config';

// Route-level code splitting: heavier screens (map, charts, scanner) load on demand.
const ScannerPage = lazy(() => import('@/features/scanner/pages/ScannerPage'));
const HistoryPage = lazy(() => import('@/features/history/pages/HistoryPage'));
const ObservationDetailPage = lazy(() => import('@/features/history/pages/ObservationDetailPage'));
const GardenPage = lazy(() => import('@/features/garden/pages/GardenPage'));
const PlantDetailPage = lazy(() => import('@/features/garden/pages/PlantDetailPage'));
const CarePage = lazy(() => import('@/features/care/pages/CarePage'));
const ExplorerPage = lazy(() => import('@/features/explorer/pages/ExplorerPage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const OnboardingPage = lazy(() => import('@/features/onboarding/pages/OnboardingPage'));
const PlantTimelinePage = lazy(() => import('@/features/timeline/pages/PlantTimelinePage'));
const ComparePage = lazy(() => import('@/features/timeline/pages/ComparePage'));
const ModelDiagnosticsPage = lazy(() => import('@/features/settings/pages/ModelDiagnosticsPage'));

/** Alias for the /observations/:id URL scheme used in the specification. */
function ObservationAlias() {
  const { id = '' } = useParams();
  return <Navigate to={`/history/${id}`} replace />;
}

export const routes: RouteObject[] = [
  {
    path: '/welcome',
    element: <OnboardingPage />,
    errorElement: <RouteError />,
  },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        element: <OnboardingGate />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'scan', element: <ScannerPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'history/:id', element: <ObservationDetailPage /> },
          { path: 'garden', element: <GardenPage /> },
          { path: 'garden/:id', element: <PlantDetailPage /> },
          { path: 'garden/:id/timeline', element: <PlantTimelinePage /> },
          { path: 'garden/:id/compare', element: <ComparePage /> },
          { path: 'observations/:id', element: <ObservationAlias /> },
          { path: 'scanner', element: <Navigate to="/scan" replace /> },
          { path: 'care', element: <CarePage /> },
          { path: 'explore', element: <ExplorerPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/ai-model/diagnostics', element: <ModelDiagnosticsPage /> },
          { path: '*', element: <RouteError /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  const basename = config.basePath === '/' ? undefined : config.basePath.replace(/\/$/, '');
  return createBrowserRouter(routes, basename ? { basename } : {});
}
