import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { modelManager } from '@/ai/model-manager/model-manager';
import { ToastProvider } from '@/components/feedback/Toaster';
import { SettingsProvider, useSettings } from '@/features/settings/hooks/useSettings';
import { AuthProvider } from '@/features/auth/AuthContext';

/** Keeps the model manager in sync with the persisted model/device selection. */
function ModelManagerBridge() {
  const { settings, loaded } = useSettings();
  useEffect(() => {
    if (!loaded) return;
    void modelManager.configure({ presetId: settings.modelPresetId, devicePreference: settings.devicePreference });
  }, [loaded, settings.modelPresetId, settings.devicePreference]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // reducedMotion="user" makes every Motion animation honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <ModelManagerBridge />
            {children}
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
