import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Camera, ExternalLink, Info, Lock, MapPin, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { config } from '@/app/config';
import { MODEL_PRESETS } from '@/ai/model-manager/presets';
import { PageHeader } from '@/components/layout/PageFallback';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, SegmentedControl, Switch } from '@/components/ui/Field';
import type { ThemePreference } from '@/db/schema';
import { DataManagement } from '../components/DataManagement';
import { ModelSettings } from '../components/ModelSettings';
import { OfflineStatus } from '../components/OfflineStatus';
import { useToast } from '@/components/feedback/Toaster';
import { errorMessage } from '@/lib/utils';
import { useSettings } from '../hooks/useSettings';

function usePermissionState(name: 'camera' | 'geolocation') {
  const [state, setState] = useState<PermissionState | 'unsupported'>('unsupported');
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const onChange = () => status && setState(status.state);
    navigator.permissions
      ?.query({ name: name as PermissionName })
      .then((result) => {
        status = result;
        setState(result.state);
        result.addEventListener('change', onChange);
      })
      .catch(() => setState('unsupported'));
    return () => status?.removeEventListener('change', onChange);
  }, [name]);
  return state;
}

const PERMISSION_TEXT: Record<PermissionState | 'unsupported', string> = {
  granted: 'Allowed',
  denied: 'Blocked — change this in your browser’s site settings',
  prompt: 'Not asked yet — PlantGuard asks only when you use the feature',
  unsupported: 'Status not reported by this browser',
};

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const saveSettings: typeof update = (patch) => update(patch).catch((error) => { toast.error('Settings were not saved', errorMessage(error)); });
  const location = useLocation();
  const camera = usePermissionState('camera');
  const geolocation = usePermissionState('geolocation');

  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  return (
    <div>
      <PageHeader title="Settings" description="Appearance, the on-device AI model, offline storage and your data." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Appearance & profile" icon={<Palette className="size-5" />} />
            <CardBody className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Theme</p>
                <SegmentedControl<ThemePreference>
                  label="Theme"
                  value={settings.theme}
                  onChange={(theme) => void saveSettings({ theme })}
                  options={[
                    { value: 'system', label: 'System', icon: <Monitor className="size-4" aria-hidden /> },
                    { value: 'light', label: 'Light', icon: <Sun className="size-4" aria-hidden /> },
                    { value: 'dark', label: 'Dark', icon: <Moon className="size-4" aria-hidden /> },
                  ]}
                />
              </div>
              <Field label="Your name (optional)" hint="Used only for the greeting on the home screen.">
                {(props) => (
                  <Input {...props} value={settings.displayName} maxLength={40} onChange={(event) => void saveSettings({ displayName: event.target.value })} />
                )}
              </Field>
              <Switch
                checked={settings.keepPhotos}
                onChange={(keepPhotos) => void saveSettings({ keepPhotos })}
                label="Keep photos with new observations by default"
                description="Turn off to store only small thumbnails and save space."
              />
            </CardBody>
          </Card>

          <ModelSettings />
          <OfflineStatus />
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Permissions" icon={<Lock className="size-5" />} />
            <CardBody className="space-y-4 text-sm">
              <div className="flex gap-3">
                <Camera className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
                <div>
                  <p className="font-medium">Camera: {PERMISSION_TEXT[camera]}</p>
                  <p className="text-ink-muted">
                    Used only when you press “Take photo”. If the camera is blocked or unavailable, “Choose photo” still works — on most phones it can open the camera too.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
                <div>
                  <p className="font-medium">
                    Location: {config.features.geolocation ? PERMISSION_TEXT[geolocation] : 'Disabled in this deployment'}
                  </p>
                  <p className="text-ink-muted">
                    Requested only when you press a location button. Coordinates are stored only with places or observations you save, on this device.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <DataManagement />

          <Card id="privacy" className="scroll-mt-24">
            <CardHeader title="Privacy" icon={<Lock className="size-5" />} />
            <CardBody className="space-y-2 text-sm text-ink-muted">
              <p>
                <strong className="text-ink">Your photos never leave your device.</strong> Analysis runs in your browser. PlantGuard has no account, no server
                database, no analytics and no tracking scripts.
              </p>
              <p>
                Network requests are limited to: loading the app itself, a one-time model download from Hugging Face (plus the ONNX Runtime from{' '}
                {config.ai.wasmBaseUrl ? 'the configured host' : 'the jsDelivr CDN'}), and map tiles from the map provider while you view the map. Those
                services can see your IP address, as with any website.
              </p>
              <p>Photos are resized and re-encoded before storage, which removes camera metadata such as GPS coordinates.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`About ${config.appName}`} icon={<Info className="size-5" />} />
            <CardBody className="space-y-3 text-sm text-ink-muted">
              <p>Version {config.appVersion}. An offline-first plant journal with on-device AI.</p>
              <p>
                AI results are estimates from a small general-purpose vision-language model. It was not trained specifically on plant diseases and is often
                wrong. Ask a local expert before acting on anything important.
              </p>
              <div>
                <p className="font-medium text-ink">Credits &amp; licenses</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {MODEL_PRESETS.map((preset) => (
                    <li key={preset.id}>
                      <a href={preset.modelCardUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 underline">
                        <span className="min-w-0 break-all">{preset.modelId}</span> <ExternalLink className="size-3 shrink-0" aria-hidden />
                      </a>{' '}
                      — {preset.license.name}, by Hugging Face (SmolVLM)
                    </li>
                  ))}
                  <li>Transformers.js and ONNX Runtime Web — Apache-2.0 / MIT</li>
                  <li>Map data © OpenStreetMap contributors (ODbL); Leaflet — BSD-2-Clause</li>
                  <li>Selected UI effects adapted from React Bits — MIT + Commons Clause</li>
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
