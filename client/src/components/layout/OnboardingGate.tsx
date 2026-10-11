import { Navigate, Outlet, useLocation } from 'react-router';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { PageFallback } from './PageFallback';

/** Sends first-time users through onboarding before the main app. */
export function OnboardingGate() {
  const { settings, loaded } = useSettings();
  const location = useLocation();
  if (!loaded) return <PageFallback />;
  if (!settings.onboardingCompleted) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
