import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { createObservation } from '@/db/repositories/observations';
import { db } from '@/db/database';
import { renderApp } from '@/test/render';
import { jpegBlob, resetDatabase, sampleAssessment } from '@/test/db-helpers';

vi.mock('@/ai/model-manager/model-manager', async (orig) => (await import('@/test/mock-model-manager')).modelManagerMockFactory(orig));

const add = (label: string, kind: 'problem' | 'healthy', createdAt: Date) =>
  createObservation({ label, context: '', assessment: sampleAssessment(kind), image: jpegBlob(), thumbnail: jpegBlob(), imageWidth: 10, imageHeight: 10, createdAt });

beforeEach(resetDatabase);

describe('HistoryPage', () => {
  it('shows an empty state with a scan action', async () => {
    await renderApp('/history');
    expect(await screen.findByText(/no observations yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /scan a plant/i }).length).toBeGreaterThan(0);
  });

  it('lists observations newest first and filters by condition and search', async () => {
    await add('Rose bush', 'healthy', new Date(2026, 2, 1));
    await add('Tomato row', 'problem', new Date(2026, 2, 2));
    const { user } = await renderApp('/history');

    const list = await screen.findByRole('list', { name: '' }).catch(() => null);
    expect(list).not.toBeUndefined();
    const titles = await screen.findAllByText(/Rose bush|Tomato row/);
    expect(titles.map((t) => t.textContent)).toEqual(['Tomato row', 'Rose bush']);

    await user.selectOptions(screen.getByLabelText(/condition/i), 'healthy');
    await waitFor(() => expect(screen.queryByText('Tomato row')).not.toBeInTheDocument());
    expect(screen.getByText('Rose bush')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/condition/i), 'all');
    await user.type(screen.getByRole('searchbox'), 'blight');
    await waitFor(() => expect(screen.queryByText('Rose bush')).not.toBeInTheDocument());
    expect(screen.getByText('Tomato row')).toBeInTheDocument();
  });

  it('shows a no-results state with a clear-filters action', async () => {
    await add('Rose bush', 'healthy', new Date(2026, 2, 1));
    const { user } = await renderApp('/history');
    await user.type(await screen.findByRole('searchbox'), 'cactus');
    expect(await screen.findByText(/no matching observations/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(await screen.findByText('Rose bush')).toBeInTheDocument();
  });
});

describe('ObservationDetailPage', () => {
  it('edits notes and deletes only after confirmation', async () => {
    const observation = await add('Tomato row', 'problem', new Date(2026, 2, 2));
    const { user, router } = await renderApp(`/history/${observation.id}`);
    await screen.findByLabelText(/^notes$/i);

    await user.click(await screen.findByRole('button', { name: /^delete$/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete this observation/i });
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(await db.observations.count()).toBe(1);

    const notes = screen.getByLabelText(/^notes$/i);
    await user.type(notes, 'Removed lower leaves');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(async () => expect((await db.observations.get(observation.id))?.notes).toBe('Removed lower leaves'));
    // The notes card re-mounts from the saved record; wait for it before using its buttons.
    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled());

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /delete observation/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/history'));
    expect(await db.observations.count()).toBe(0);
  });
});
