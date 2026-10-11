import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { modelManager } from '@/ai/model-manager/model-manager';
import { DemoVisionProvider } from '@/ai/providers/demo-provider';
import { db } from '@/db/database';
import { createCareTask } from '@/db/repositories/care';
import { createObservation } from '@/db/repositories/observations';
import { renderApp } from '@/test/render';
import { jpegBlob, resetDatabase, sampleAssessment } from '@/test/db-helpers';
import { testProvider } from '@/test/mock-model-manager';
import * as backup from '@/services/export-import/backup';

vi.mock('@/ai/model-manager/model-manager', async (orig) => (await import('@/test/mock-model-manager')).modelManagerMockFactory(orig));

async function seed() {
  await createObservation({ label: 'Leaf', context: '', assessment: sampleAssessment(), image: jpegBlob(), thumbnail: jpegBlob(), imageWidth: 1, imageHeight: 1 });
  await createCareTask({ title: 'Water herbs', kind: 'water' });
}

beforeEach(async () => {
  await resetDatabase();
  testProvider.current = new DemoVisionProvider();
  await modelManager.refresh();
});

describe('SettingsPage destructive actions', () => {
  it('clears only scan history after confirmation and keeps the model', async () => {
    await seed();
    await modelManager.download();
    const deleteCache = vi.spyOn(testProvider.current, 'deleteCache');
    const { user } = await renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: /clear scan history/i }, { timeout: 10000 }));
    const dialog = await screen.findByRole('dialog', { name: /clear scan history/i }, { timeout: 10000 });
    expect(dialog).toHaveTextContent(/AI model are kept/i);
    await user.click(within(dialog).getByRole('button', { name: /^clear history$/i }));

    await waitFor(async () => expect(await db.observations.count()).toBe(0));
    expect(await db.careTasks.count()).toBe(1);
    expect(deleteCache).not.toHaveBeenCalled();
    expect(modelManager.getSnapshot().cached).toBe(true);
  });

  it('cancelling "clear all" changes nothing', async () => {
    await seed();
    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: /clear all local data/i }));
    const dialog = await screen.findByRole('dialog', { name: /clear all local data/i });
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(await db.observations.count()).toBe(1);
    expect(await db.careTasks.count()).toBe(1);
  });

  it('deletes the cached model only after confirmation and leaves user data alone', async () => {
    await seed();
    await modelManager.download();
    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: /delete downloaded model/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete the downloaded model/i });
    expect(dialog).toHaveTextContent(/NOT deleted/);
    await user.click(within(dialog).getByRole('button', { name: /delete model files/i }));
    await waitFor(() => expect(modelManager.getSnapshot().cached).toBe(false));
    expect(await db.observations.count()).toBe(1);
  });
});

describe('SettingsPage import/export', () => {
  it('exports a backup file', async () => {
    await seed();
    const download = vi.spyOn(backup, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = await renderApp('/settings');
    await user.click(await screen.findByRole('switch', { name: /include photos/i }));
    await user.click(screen.getByRole('button', { name: /export backup/i }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download.mock.calls[0]![1]).toMatch(/^plantguard-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('previews an import before applying it, then merges', async () => {
    await seed();
    const { blob } = await backup.createBackup({ includePhotos: false, appVersion: 'test' });
    await resetDatabase();
    const { user } = await renderApp('/settings');
    const file = new File([await blob.arrayBuffer()], 'backup.json', { type: 'application/json' });
    await user.upload(await screen.findByTestId('import-input'), file);

    const dialog = await screen.findByRole('dialog', { name: /import this backup/i });
    expect(within(dialog).getByText('Observations').nextSibling).toHaveTextContent('1');
    expect(await db.observations.count()).toBe(0); // nothing applied yet
    await user.click(within(dialog).getByRole('button', { name: /^import$/i }));
    await waitFor(async () => expect(await db.observations.count()).toBe(1));
  });

  it('rejects an invalid backup with a clear message', async () => {
    const { user } = await renderApp('/settings');
    const file = new File(['{"format":"something-else"}'], 'bad.json', { type: 'application/json' });
    await user.upload(await screen.findByTestId('import-input'), file);
    expect(await screen.findByText(/not a PlantGuard backup/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /import this backup/i })).not.toBeInTheDocument();
  });
});
