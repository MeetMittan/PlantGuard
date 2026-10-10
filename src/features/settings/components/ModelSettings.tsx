import { useState } from 'react';
import { Link } from 'react-router';
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { config } from '@/app/config';
import { modelManager, useModelState } from '@/ai/model-manager/useModelManager';
import { MODEL_PRESETS } from '@/ai/model-manager/presets';
import type { DevicePreference } from '@/db/schema';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/feedback/Toaster';
import { formatBytes } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useSettings } from '../hooks/useSettings';
import { ModelReadinessCard } from './ModelReadinessCard';

export function ModelSettings() {
  const { settings, update } = useSettings();
  const model = useModelState();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = ['downloading', 'loading', 'running'].includes(model.state);
  const customModel = Boolean(config.ai.modelId && !MODEL_PRESETS.some((p) => p.modelId === config.ai.modelId));
  const activePresetId = model.model.presetId;

  const deleteModel = async () => {
    setDeleting(true);
    try {
      const deleted = await modelManager.deleteCachedModel();
      toast.success('Model files deleted', `${deleted} file(s) removed from this browser. Your observations were not affected.`);
    } catch (error) {
      toast.error('Could not delete the model', errorMessage(error));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Card id="ai-model" className="scroll-mt-24">
      <CardHeader
        title="AI model"
        description="Runs locally on this device. Download once while online; analysis then works offline."
      />
      <CardBody className="space-y-5">
        <ModelReadinessCard className="shadow-none" />

        {model.providerKind === 'transformersjs' && !customModel ? (
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="mb-1 text-sm font-medium">Model</legend>
            {MODEL_PRESETS.map((preset) => {
              const checked = activePresetId === preset.id;
              return (
                <label
                  key={preset.id}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors',
                    checked ? 'border-forest bg-forest-soft/50' : 'border-line hover:bg-surface-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="model-preset"
                    className="mt-1 size-4 accent-[var(--pg-forest)]"
                    checked={checked}
                    onChange={() => void update({ modelPresetId: preset.id }).catch((error) => toast.error('Settings were not saved', errorMessage(error)))}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{preset.label}</span>
                    <span className="block text-sm text-ink-muted">{preset.description}</span>
                    <span className="mt-1 block text-xs text-ink-subtle">
                      {preset.parameters} parameters · ≈{formatBytes(preset.approxDownloadBytes, 0)} download · {preset.license.name} ·{' '}
                      <a href={preset.modelCardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                        model card <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </span>
                  </span>
                </label>
              );
            })}
            <p className="text-xs text-ink-subtle">Switching models needs a separate download. Each model’s files are stored independently.</p>
          </fieldset>
        ) : customModel ? (
          <p className="text-sm text-ink-muted">This deployment uses a custom model: {config.ai.modelId}.</p>
        ) : null}

        {model.providerKind === 'transformersjs' ? (
          <div className="space-y-2">
            <label htmlFor="device-pref" className="text-sm font-medium">
              Acceleration
            </label>
            <select
              id="device-pref"
              value={settings.devicePreference}
              disabled={busy}
              onChange={(event) => void update({ devicePreference: event.target.value as DevicePreference }).catch((error) => toast.error('Settings were not saved', errorMessage(error)))}
              className="block w-full max-w-xs rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-sm"
            >
              <option value="auto">Automatic (GPU if available)</option>
              <option value="webgpu">GPU only (WebGPU)</option>
              <option value="wasm">CPU only (WebAssembly)</option>
            </select>
            <p className="text-xs text-ink-subtle">
              WebGPU detected: {model.capabilities ? (model.capabilities.webgpu ? 'yes' : 'no') : 'checking…'}. CPU mode is slower but works on more devices.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => void modelManager.refresh()} disabled={busy}>
            Re-check storage
          </Button>
          {model.cached ? (
            <Button variant="ghost" size="sm" className="text-clay" disabled={busy} icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>
              Delete downloaded model
            </Button>
          ) : null}
          <Link to="/settings/ai-model/diagnostics" className="self-center text-sm text-forest underline">Model diagnostics</Link>
        </div>
      </CardBody>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete the downloaded model?"
        description={`Removes the ${model.model.label} files from this browser to free space.`}
        details={
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Your observations, plants, care history and settings are NOT deleted.</li>
            <li>AI analysis will be unavailable until you download the model again (internet required).</li>
          </ul>
        }
        confirmLabel="Delete model files"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteModel()}
      />
    </Card>
  );
}
