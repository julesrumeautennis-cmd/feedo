import { test, expect } from '@playwright/test';

test('Le technicien progresse après une erreur et prouve deux réparations en 3D', async ({ page }) => {
  const exceptions = [];
  page.on('pageerror', error => exceptions.push(error.message));
  await page.goto('/');
  await expect(page.locator('#view canvas')).toBeVisible({timeout: 45000});
  const press = id => page.locator('[data-action="'+id+'"]').click();
  await press('photograph');
  await press('inspect-B');
  await press('hint');
  await press('inspect-A');
  await press('isolate-A');
  await press('repair');
  await press('verify');
  await expect(page.locator('#coach')).toContainText(/isolé|pression/i);
  await press('restore');
  await press('verify');
  await expect(page.locator('#results')).toBeVisible();
  await press('next-case');
  for (const step of ['photograph','inspect-B','isolate-B','repair','restore','verify']) await press(step);
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#results')).toContainText(/autonome/i);
  expect(exceptions).toEqual([]);
});

test('Mobile et API de la preview', async ({page,request}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('[data-action="photograph"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const status = await request.post('/api/training',{data:{task:'status'}});
  expect(status.ok()).toBeTruthy();
  expect(await status.json()).toEqual({telem:expect.any(Boolean),band:expect.any(Boolean)});
  const invalid = await request.post('/api/training',{data:{task:'handoff',variant:'A',history:['repair']}});
  expect(invalid.status()).toBe(400);
});
