import { useRef, useState } from 'react';
import { Database, Download, Trash2, Upload } from 'lucide-react';
import { config } from '@/app/config';
import { clearLocalData } from '@/db/repositories/data-management';
import { clearObservations } from '@/db/repositories/observations';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Field';
import { useToast } from '@/components/feedback/Toaster';
import {
  applyBackup,
  createBackup,
  downloadBlob,
  parseBackupFile,
  type ImportMode,
  type ParsedBackup,
} from '@/services/export-import/backup';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/utils';

export function DataManagement() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState<'history' | 'all' | null>(null);
  const [clearing, setClearing] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      const { blob, filename, manifest } = await createBackup({ includePhotos, appVersion: config.appVersion });
      downloadBlob(blob, filename);
      toast.success('Backup created', `${manifest.data.observations.length} observations exported to ${filename}.`);
    } catch (error) {
      toast.error('Export failed', errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const pickImport = async (file: File) => {
    try {
      setParsed(await parseBackupFile(file));
      setImportMode('merge');
    } catch (error) {
      toast.error('This backup cannot be imported', errorMessage(error));
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      const result = await applyBackup(parsed, importMode);
      toast.success('Import complete', `${result.added} records added, ${result.skippedDuplicates} duplicates skipped.`);
      setParsed(null);
    } catch (error) {
      toast.error('Import failed — nothing was changed', errorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    try {
      if (confirm === 'history') {
        await clearObservations();
        toast.success('Scan history cleared');
      } else if (confirm === 'all') {
        await clearLocalData();
        toast.success('All local data cleared');
      }
    } catch (error) {
      toast.error('Could not clear data', errorMessage(error));
    } finally {
      setClearing(false);
      setConfirm(null);
    }
  };

  return (
    <Card id="data">
      <CardHeader title="Your data" icon={<Database className="size-5" />} description="Back up, restore or remove what PlantGuard stores on this device." />
      <CardBody className="space-y-6">
        <section className="space-y-3">
          <h3 className="font-sans text-sm font-semibold">Export</h3>
          <Switch
            checked={includePhotos}
            onChange={setIncludePhotos}
            label="Include photos"
            description="Creates a .zip with photos; without photos a smaller .json file is created."
          />
          <Button icon={<Download className="size-4" aria-hidden />} onClick={() => void exportData()} loading={exporting}>
            Export backup
          </Button>
          <p className="text-xs text-ink-subtle">
            Backups contain your notes, plant names and any saved locations. Store them somewhere private. The AI model is not included.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="font-sans text-sm font-semibold">Import</h3>
          <input
            ref={fileInput}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="import-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void pickImport(file);
            }}
          />
          <Button variant="secondary" icon={<Upload className="size-4" aria-hidden />} onClick={() => fileInput.current?.click()}>
            Import backup…
          </Button>
          <p className="text-xs text-ink-subtle">You will see a summary before anything is changed. Maximum 300 MB.</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-clay/30 p-4">
          <h3 className="font-sans text-sm font-semibold text-clay">Danger zone</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirm('history')}>
              Clear scan history
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirm('all')}>
              Clear all local data
            </Button>
          </div>
          <p className="text-xs text-ink-subtle">Neither action deletes the downloaded AI model — manage that in the AI model section.</p>
        </section>
      </CardBody>

      <Dialog
        open={parsed !== null}
        onClose={() => setParsed(null)}
        title="Import this backup?"
        description={parsed ? `Created ${formatDateTime(parsed.manifest.exportedAt)} by PlantGuard ${parsed.manifest.appVersion}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setParsed(null)} disabled={importing}>
              Cancel
            </Button>
            <Button variant={importMode === 'replace' ? 'danger' : 'primary'} onClick={() => void runImport()} loading={importing}>
              {importMode === 'replace' ? 'Replace my data' : 'Import'}
            </Button>
          </>
        }
      >
        {parsed ? (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-ink-muted">Observations</dt>
              <dd>{parsed.summary.observations}</dd>
              <dt className="text-ink-muted">Plants</dt>
              <dd>{parsed.summary.plants}</dd>
              <dt className="text-ink-muted">Care tasks</dt>
              <dd>{parsed.summary.careTasks}</dd>
              <dt className="text-ink-muted">Care completions</dt>
              <dd>{parsed.summary.careCompletions}</dd>
              <dt className="text-ink-muted">Saved places</dt>
              <dd>{parsed.summary.savedPlaces}</dd>
              <dt className="text-ink-muted">Photos</dt>
              <dd>{parsed.summary.photos}</dd>
            </dl>
            <fieldset className="space-y-2">
              <legend className="mb-1 font-medium">How should it be imported?</legend>
              <label className="flex gap-2">
                <input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
                <span>
                  <span className="font-medium">Merge</span> — add new records, keep everything you already have. Duplicates are skipped.
                </span>
              </label>
              <label className="flex gap-2">
                <input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
                <span>
                  <span className="font-medium">Replace</span> — delete current observations, plants, tasks and places first.
                </span>
              </label>
            </fieldset>
            <p className="text-xs text-ink-subtle">The import runs as one transaction: if anything fails, your existing data stays unchanged.</p>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm === 'history'}
        title="Clear scan history?"
        description="Deletes every saved observation, including photos and AI assessments."
        details={
          <p className="text-sm text-ink-muted">
            Plants, care tasks, saved places, settings and the AI model are kept. Your streak may go down because observations count toward it.
          </p>
        }
        confirmLabel="Clear history"
        busy={clearing}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void clear()}
      />
      <ConfirmDialog
        open={confirm === 'all'}
        title="Clear all local data?"
        description="Deletes observations, photos, plants, care tasks and history, saved places and settings from this device."
        details={
          <p className="text-sm text-ink-muted">
            The downloaded AI model is kept. This cannot be undone — export a backup first if you might need it.
          </p>
        }
        confirmLabel="Clear everything"
        busy={clearing}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void clear()}
      />
    </Card>
  );
}
