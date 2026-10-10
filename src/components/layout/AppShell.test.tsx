import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { renderApp } from '@/test/render';
import { resetDatabase } from '@/test/db-helpers';

vi.mock('@/ai/model-manager/model-manager', async (orig) => (await import('@/test/mock-model-manager')).modelManagerMockFactory(orig));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

beforeEach(async () => {
  await resetDatabase();
  setOnline(true);
});
afterEach(() => setOnline(true));

describe('AppShell', () => {
  it('renders desktop sidebar and mobile navigation with the same destinations', async () => {
    await renderApp('/');
    const navs = await screen.findAllByRole('navigation', { name: 'Main' });
    expect(navs).toHaveLength(2);
    const [sidebar, mobile] = navs;
    for (const name of [/home/i, /history/i, /care/i]) {
      expect(within(sidebar!).getByRole('link', { name })).toBeInTheDocument();
      expect(within(mobile!).getByRole('link', { name })).toBeInTheDocument();
    }
    // The scanner is a prominent action in the mobile bar; remaining destinations sit under "More".
    expect(within(mobile!).getByRole('link', { name: /scan a plant/i })).toBeInTheDocument();
    expect(within(mobile!).getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('opens the "More" menu with the other destinations', async () => {
    const { user } = await renderApp('/');
    const mobile = (await screen.findAllByRole('navigation', { name: 'Main' }))[1]!;
    await user.click(within(mobile).getByRole('button', { name: /more/i }));
    const dialog = await screen.findByRole('dialog', { name: /more/i });
    for (const name of [/my garden/i, /explorer/i, /settings/i]) {
      expect(within(dialog).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('shows an offline indicator when connectivity drops', async () => {
    await renderApp('/');
    await screen.findAllByRole('navigation', { name: 'Main' });
    expect(screen.queryAllByText('Offline')).toHaveLength(0);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect((await screen.findAllByText('Offline')).length).toBeGreaterThan(0);
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryAllByText('Offline')).toHaveLength(0);
  });

  it('redirects first-time users to onboarding', async () => {
    const { router } = await renderApp('/history', { onboarded: false });
    expect(await screen.findByRole('heading', { name: /look after your plants/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
  });
});
