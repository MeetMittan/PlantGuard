import { expect, type Page } from '@playwright/test';

export async function completeOnboarding(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel(/what should we call you/i).fill('Asha');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /works offline/i })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /start using plantguard/i }).click();
  await expect(page.getByRole('heading', { name: /your plants, at a glance/i })).toBeVisible();
}

/** Downloads the (demo) model via the real UI flow, including the size confirmation dialog. */
export async function setUpModel(page: Page) {
  await page.goto('/settings#ai-model');
  await page.getByRole('button', { name: /download ai model/i }).first().click();
  await page.getByRole('dialog', { name: /download the ai model/i }).getByRole('button', { name: /^download$/i }).click();
  await expect(page.getByRole('link', { name: /demo ai ready/i }).first()).toBeVisible();
}

/** Primary navigation works the same on mobile (bottom bar / More menu) and desktop (sidebar). */
export async function navigate(page: Page, name: RegExp) {
  // getByRole ignores hidden elements, so only the layout's visible "Main" nav matches.
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  const nav = page.getByRole('navigation', { name: 'Main' });
  if (desktop) {
    await nav.getByRole('link', { name }).click();
    return;
  }
  const bar = nav;
  const direct = bar.getByRole('link', { name });
  if (await direct.count()) {
    await direct.click();
    return;
  }
  await bar.getByRole('button', { name: /more/i }).click();
  await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name }).click();
}
