import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { updateSettings } from '@/db/repositories/settings';

/** Renders the real route tree at `path` with all providers, after onboarding. */
export async function renderApp(path: string, options: { onboarded?: boolean } = {}) {
  if (options.onboarded !== false) await updateSettings({ onboardingCompleted: true });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const result = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, user };
}
