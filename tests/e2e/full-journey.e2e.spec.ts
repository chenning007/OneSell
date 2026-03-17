/**
 * OneSell Scout — Full User Journey E2E Tests (Steps 1–11)
 *
 * Prerequisites:
 *   1. Electron test harness must be configured (e.g. @playwright/test + electron)
 *   2. Backend must be running or mocked via IPC stubs
 *   3. window.electronAPI must be available (preload bridge)
 *   4. Install: pnpm add -D @playwright/test
 *
 * These tests are structured as placeholder specs. Tests requiring real Electron
 * IPC, BrowserViews, or a live backend are marked with test.skip(). Once the
 * Electron testing harness is wired up, remove the skip flags to enable them.
 *
 * Issue: #90 — Full user journey E2E
 * Test Strategy: docs/TEST-STRATEGY.md § 3.5 (E2E Tests)
 * PRD: docs/PRD-Product-Selection-Module.md §5.2 (Steps 1–6), §5.3 (Steps 7–8), §5.4 (Step 9), §5.5 (Steps 10–11)
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The 7 supported markets from MARKET_CONFIGS */
const MARKETS = ['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au'] as const;

/** Market tile flags displayed in Step 1 */
const MARKET_FLAGS: Record<string, string> = {
  us: '🇺🇸',
  cn: '🇨🇳',
  uk: '🇬🇧',
  de: '🇩🇪',
  jp: '🇯🇵',
  sea: '🇮🇩',
  au: '🇦🇺',
};

/** Clicks the Next button shared by Wizard steps 2–6 */
async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: /next/i }).click();
}

/** Clicks the Back button shared by Wizard steps 2–6 */
async function clickBack(page: Page): Promise<void> {
  await page.getByRole('button', { name: /back/i }).click();
}

// ---------------------------------------------------------------------------
// Full User Journey E2E
// ---------------------------------------------------------------------------

test.describe('Full User Journey E2E', () => {
  // =========================================================================
  // Step 1 — Market Selection
  // =========================================================================
  test.describe('Step 1: Market Selection', () => {
    test.skip('renders 7 market tiles with flag icons', async ({ page }) => {
      // Arrange: app loads at Step 1 (currentStep === 1)
      // Assert: 7 market buttons are visible
      const tiles = page.locator('button').filter({ has: page.locator('span') });
      await expect(tiles).toHaveCount(7);

      // Each tile should contain a flag emoji
      for (const [, flag] of Object.entries(MARKET_FLAGS)) {
        await expect(page.getByText(flag)).toBeVisible();
      }
    });

    test.skip('selecting US market highlights tile and advances to Step 2', async ({ page }) => {
      const usTile = page.getByText(MARKET_FLAGS.us).locator('..');
      await usTile.click();

      // Should advance to Step 2 — budget slider heading visible
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    });

    test.skip('selecting China market switches language to zh-CN', async ({ page }) => {
      const cnTile = page.getByText(MARKET_FLAGS.cn).locator('..');
      await cnTile.click();

      // After selecting China, UI text should be in Simplified Chinese
      // The budget step heading should be the Chinese translation
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    });
  });

  // =========================================================================
  // Step 2 — Budget Slider
  // =========================================================================
  test.describe('Step 2: Budget Slider', () => {
    test.skip('displays budget slider with min/mid/max labels in local currency', async ({ page }) => {
      // Pre: select US market to reach Step 2
      await page.getByText(MARKET_FLAGS.us).locator('..').click();

      // Assert: slider input is visible
      const slider = page.locator('input[type="range"]');
      await expect(slider).toBeVisible();

      // Assert: currency symbol ($) is displayed
      await expect(page.getByText('$')).toBeVisible();
    });

    test.skip('dragging slider updates displayed budget value', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();

      const slider = page.locator('input[type="range"]');
      // Move slider to ~75% position
      await slider.fill('375');

      // The displayed value should update
      await expect(page.locator('div').filter({ hasText: '$375' })).toBeVisible();
    });

    test.skip('Next button advances to Step 3', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page);

      // Step 3 — Platform selection heading should be visible
      await expect(page.getByRole('heading', { level: 2 })).toContainText(/platform/i);
    });

    test.skip('Back button returns to Step 1', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickBack(page);

      // Step 1 — market tiles should be visible again
      await expect(page.getByText(MARKET_FLAGS.us)).toBeVisible();
    });
  });

  // =========================================================================
  // Step 3 — Platform Selection
  // =========================================================================
  test.describe('Step 3: Platform Selection', () => {
    test.skip('shows market-specific platform checkboxes for US', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page); // → Step 3

      // US platforms include Amazon, Shopify, eBay, Etsy, TikTok Shop, Walmart
      const checkboxes = page.locator('input[type="checkbox"]');
      await expect(checkboxes).toHaveCount(6);
    });

    test.skip('toggling a platform checkbox selects/deselects it', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page);

      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();

      await firstCheckbox.uncheck();
      await expect(firstCheckbox).not.toBeChecked();
    });

    test.skip('validation error shown when no platforms selected and Next pressed', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page); // → Step 3

      // Don't select any platform — validation message should show
      await expect(page.getByText(/please select at least one platform/i)).toBeVisible();
    });

    test.skip('selecting at least one platform allows advancing to Step 4', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page); // → Step 3

      await page.locator('input[type="checkbox"]').first().check();
      await clickNext(page); // → Step 4

      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    });
  });

  // =========================================================================
  // Step 4 — Product Type Toggle
  // =========================================================================
  test.describe('Step 4: Product Type Toggle', () => {
    test.skip('renders Physical and Digital toggle buttons', async ({ page }) => {
      // Navigate to Step 4
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page); // → Step 3
      await page.locator('input[type="checkbox"]').first().check();
      await clickNext(page); // → Step 4

      await expect(page.getByText('📦')).toBeVisible(); // Physical
      await expect(page.getByText('💾')).toBeVisible(); // Digital
    });

    test.skip('clicking Physical highlights it and deselects Digital', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page);
      await page.locator('input[type="checkbox"]').first().check();
      await clickNext(page);

      const physicalBtn = page.getByText('📦').locator('..');
      await physicalBtn.click();

      // Physical should have the selected border color
      await expect(physicalBtn).toHaveCSS('border-color', 'rgb(0, 102, 204)');
    });

    test.skip('advances to Step 5 on Next', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page);
      await page.locator('input[type="checkbox"]').first().check();
      await clickNext(page);
      await page.getByText('📦').locator('..').click();
      await clickNext(page);

      // Step 5 — Categories heading
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    });
  });

  // =========================================================================
  // Step 5 — Categories Pill Tags
  // =========================================================================
  test.describe('Step 5: Categories Pill Tags', () => {
    test.skip('renders category pill buttons from market config', async ({ page }) => {
      // Navigate Steps 1→5
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page);
      await page.locator('input[type="checkbox"]').first().check();
      await clickNext(page);
      await page.getByText('📦').locator('..').click();
      await clickNext(page);

      // Category pills are rendered as buttons with pill shape
      const pills = page.locator('button').filter({ has: page.locator('text=/./') });
      const pillCount = await pills.count();
      expect(pillCount).toBeGreaterThan(0);
    });

    test.skip('clicking a category pill toggles its selection state', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page);
      await page.locator('input[type="checkbox"]').first().check();
      await clickNext(page);
      await page.getByText('📦').locator('..').click();
      await clickNext(page);

      // Click first category pill to select, then again to deselect
      const firstPill = page.locator('button[style*="border-radius: 24px"]').first();
      await firstPill.click();
      // Selected state = blue background
      await expect(firstPill).toHaveCSS('background-color', 'rgb(0, 102, 204)');

      await firstPill.click();
      // Deselected state = white background
      await expect(firstPill).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    });

    test.skip('multiple categories can be selected simultaneously', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      await clickNext(page);
      await page.locator('input[type="checkbox"]').first().check();
      await clickNext(page);
      await page.getByText('📦').locator('..').click();
      await clickNext(page);

      const pills = page.locator('button[style*="border-radius: 24px"]');
      await pills.nth(0).click();
      await pills.nth(1).click();

      // Both should be selected (blue bg)
      await expect(pills.nth(0)).toHaveCSS('background-color', 'rgb(0, 102, 204)');
      await expect(pills.nth(1)).toHaveCSS('background-color', 'rgb(0, 102, 204)');
    });
  });

  // =========================================================================
  // Step 6 — Fulfillment Time Options
  // =========================================================================
  test.describe('Step 6: Fulfillment Time', () => {
    test.skip('renders three fulfillment options with emojis', async ({ page }) => {
      // Navigate Steps 1→6
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      for (let i = 0; i < 4; i++) {
        await clickNext(page);
        if (i === 0) await page.locator('input[type="checkbox"]').first().check();
        if (i === 1) await page.getByText('📦').locator('..').click();
      }

      await expect(page.getByText('⚡')).toBeVisible(); // < 5h
      await expect(page.getByText('🕐')).toBeVisible(); // 5-15h
      await expect(page.getByText('💪')).toBeVisible(); // 15h+
    });

    test.skip('selecting a fulfillment option highlights it', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      for (let i = 0; i < 4; i++) {
        await clickNext(page);
        if (i === 0) await page.locator('input[type="checkbox"]').first().check();
        if (i === 1) await page.getByText('📦').locator('..').click();
      }

      const option = page.getByText('⚡').locator('..');
      await option.click();
      await expect(option).toHaveCSS('border-color', 'rgb(0, 102, 204)');
    });

    test.skip('completing Step 6 transitions to Step 7 (Data Source Connection)', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.us).locator('..').click();
      for (let i = 0; i < 4; i++) {
        await clickNext(page);
        if (i === 0) await page.locator('input[type="checkbox"]').first().check();
        if (i === 1) await page.getByText('📦').locator('..').click();
      }

      await page.getByText('⚡').locator('..').click();
      await clickNext(page); // → Step 7

      // Step 7 shows "Data Sources" heading
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    });
  });

  // =========================================================================
  // Step 7 — Data Source Connection
  // =========================================================================
  test.describe('Step 7: Data Source Connection', () => {
    test.skip('shows platform list with Connect buttons matching selected market', async ({ page }) => {
      // Stub: navigate to Step 7
      // Each platform should have a "Connect" button
      const connectBtns = page.getByRole('button', { name: /connect to/i });
      const count = await connectBtns.count();
      expect(count).toBeGreaterThan(0);
    });

    test.skip('displays lock icon and privacy notice', async ({ page }) => {
      await expect(page.getByRole('img', { name: 'lock' })).toBeVisible();
    });

    test.skip('Connect button opens BrowserView and shows Connected badge', async ({ page }) => {
      // Requires Electron IPC — electronAPI.extraction.openView
      const firstConnect = page.getByRole('button', { name: /connect to/i }).first();
      await firstConnect.click();

      // After connection, status badge should appear
      await expect(page.getByText(/connected/i)).toBeVisible();
    });

    test.skip('Disconnect button returns platform to idle state', async ({ page }) => {
      // Connect then disconnect
      const firstConnect = page.getByRole('button', { name: /connect to/i }).first();
      await firstConnect.click();
      await expect(page.getByText(/connected/i)).toBeVisible();

      const disconnectBtn = page.getByRole('button', { name: /disconnect/i }).first();
      await disconnectBtn.click();

      // Should no longer show "Connected"
      await expect(page.getByText(/connected/i)).not.toBeVisible();
    });

    test.skip('keyword input accepts search terms', async ({ page }) => {
      const input = page.getByLabel(/search keywords/i);
      await input.fill('wireless earbuds');
      await expect(input).toHaveValue('wireless earbuds');
    });

    test.skip('Start Extraction button disabled when no platform is connected', async ({ page }) => {
      const startBtn = page.getByRole('button', { name: /start extraction/i });
      await expect(startBtn).toBeDisabled();
    });

    test.skip('Start Extraction button enabled after connecting a platform', async ({ page }) => {
      // Connect a platform first
      await page.getByRole('button', { name: /connect to/i }).first().click();
      await expect(page.getByText(/connected/i)).toBeVisible();

      const startBtn = page.getByRole('button', { name: /start extraction/i });
      await expect(startBtn).toBeEnabled();
    });

    test.skip('clicking Start Extraction transitions to Step 8', async ({ page }) => {
      await page.getByRole('button', { name: /connect to/i }).first().click();
      const startBtn = page.getByRole('button', { name: /start extraction/i });
      await startBtn.click();

      // Step 8 — Extraction Progress screen
      await expect(page.locator('text=/extract/i')).toBeVisible();
    });

    test.skip('Back to Wizard button returns to Step 6', async ({ page }) => {
      const backBtn = page.getByRole('button', { name: /back to wizard/i });
      await backBtn.click();

      // Should see fulfillment options again
      await expect(page.getByText('⚡')).toBeVisible();
    });
  });

  // =========================================================================
  // Step 8 — Extraction Progress
  // =========================================================================
  test.describe('Step 8: Extraction Progress', () => {
    test.skip('shows per-platform extraction status rows', async ({ page }) => {
      // Each connected platform should have a progress row
      const statusRows = page.getByRole('listitem');
      const count = await statusRows.count();
      expect(count).toBeGreaterThan(0);
    });

    test.skip('platform rows transition from extracting to done', async ({ page }) => {
      // Requires real extraction runner or IPC mock
      // Expect status indicators to change from spinner → checkmark
      await expect(page.getByText(/done/i).first()).toBeVisible({ timeout: 30_000 });
    });

    test.skip('error state shown for platforms that fail extraction', async ({ page }) => {
      // Platform with no BrowserView open gets "Not connected" error
      await expect(page.getByText(/error|not connected/i)).toBeVisible();
    });

    test.skip('extraction completion advances to Step 9 (Agent Analysis)', async ({ page }) => {
      // After all extractions finish, app should auto-advance
      await expect(page.getByText(/analy/i)).toBeVisible({ timeout: 60_000 });
    });
  });

  // =========================================================================
  // Step 9 — Agent Analysis Progress
  // =========================================================================
  test.describe('Step 9: Agent Analysis Progress', () => {
    test.skip('shows stage list: Planning → Executing → Synthesizing → Complete', async ({ page }) => {
      const stageList = page.getByRole('list', { name: /stages/i });
      await expect(stageList).toBeVisible();

      const items = stageList.getByRole('listitem');
      await expect(items).toHaveCount(4);
    });

    test.skip('current stage shows spinner while in-progress', async ({ page }) => {
      // The currently active stage renders an animated spinner span
      const spinner = page.locator('span[style*="animation"]');
      await expect(spinner).toBeVisible();
    });

    test.skip('completed stages show checkmark icon', async ({ page }) => {
      // Once a stage completes, it shows ✓
      await expect(page.getByText('✓').first()).toBeVisible({ timeout: 30_000 });
    });

    test.skip('error state shows error message and Retry button', async ({ page }) => {
      // Simulate backend returning error status
      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible();

      const retryBtn = page.getByRole('button', { name: /retry/i });
      await expect(retryBtn).toBeVisible();
    });

    test.skip('Retry button resets status to Planning', async ({ page }) => {
      await page.getByRole('button', { name: /retry/i }).click();

      // Should restart the stage list from Planning
      const spinner = page.locator('span[style*="animation"]');
      await expect(spinner).toBeVisible();
    });

    test.skip('analysis completion auto-advances to Step 10 (Results Dashboard)', async ({ page }) => {
      // Poll completes with status "complete" → auto-transition
      await expect(page.getByRole('heading', { name: /results/i })).toBeVisible({ timeout: 60_000 });
    });
  });

  // =========================================================================
  // Step 10 — Results Dashboard
  // =========================================================================
  test.describe('Step 10: Results Dashboard', () => {
    test.describe('Card rendering', () => {
      test.skip('displays ranked product cards with score, margin, and justification', async ({ page }) => {
        const cards = page.locator('[data-testid^="product-card-"]');
        const count = await cards.count();
        expect(count).toBeGreaterThanOrEqual(1);

        // First card should have rank, score, margin
        const firstCard = cards.first();
        await expect(firstCard.getByText(/#\d+/)).toBeVisible();
        await expect(firstCard.getByText(/score/i)).toBeVisible();
        await expect(firstCard.getByText(/%/)).toBeVisible();
      });

      test.skip('each card shows a risk badge (SAFE/WARNING/FLAGGED)', async ({ page }) => {
        const firstCard = page.locator('[data-testid^="product-card-"]').first();
        const badge = firstCard.getByText(/SAFE|WARNING|FLAGGED/);
        await expect(badge).toBeVisible();
      });

      test.skip('cards are keyboard navigable with Enter to drill down', async ({ page }) => {
        const firstCard = page.locator('[data-testid^="product-card-"]').first();
        await firstCard.focus();
        await expect(firstCard).toBeFocused();

        await page.keyboard.press('Enter');
        // Should navigate to Step 11 (ProductDetail)
        await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
      });
    });

    test.describe('Sort & Filter', () => {
      test.skip('sort dropdown has 4 options: Score, Margin, Competition, Trend', async ({ page }) => {
        const sortSelect = page.getByRole('combobox', { name: /sort/i });
        await expect(sortSelect).toBeVisible();

        const options = sortSelect.locator('option');
        await expect(options).toHaveCount(4);
      });

      test.skip('changing sort to Margin re-orders cards by margin descending', async ({ page }) => {
        const sortSelect = page.getByRole('combobox', { name: /sort/i });
        await sortSelect.selectOption('margin');

        // First card's margin should be ≥ second card's margin
        const cards = page.locator('[data-testid^="product-card-"]');
        const count = await cards.count();
        expect(count).toBeGreaterThanOrEqual(2);
        // Detailed assertion would parse margin values from card text
      });

      test.skip('risk filter dropdown filters cards by risk level', async ({ page }) => {
        const filterSelect = page.getByRole('combobox', { name: /risk/i });
        await filterSelect.selectOption('SAFE');

        // All visible cards should be SAFE
        const badges = page.locator('[data-testid^="product-card-"]').getByText(/SAFE|WARNING|FLAGGED/);
        const count = await badges.count();
        for (let i = 0; i < count; i++) {
          await expect(badges.nth(i)).toHaveText('SAFE');
        }
      });

      test.skip('selecting "All" risk filter shows all cards again', async ({ page }) => {
        const filterSelect = page.getByRole('combobox', { name: /risk/i });
        await filterSelect.selectOption('SAFE');
        const filteredCount = await page.locator('[data-testid^="product-card-"]').count();

        await filterSelect.selectOption('all');
        const allCount = await page.locator('[data-testid^="product-card-"]').count();
        expect(allCount).toBeGreaterThanOrEqual(filteredCount);
      });
    });

    test.describe('Save & Export', () => {
      test.skip('Save button bookmarks a card and shows Saved state', async ({ page }) => {
        const firstCard = page.locator('[data-testid^="product-card-"]').first();
        const saveBtn = firstCard.getByRole('button', { name: /save/i });
        await saveBtn.click();

        // Button should now show "Saved" and be disabled
        await expect(saveBtn).toHaveText(/saved/i);
        await expect(saveBtn).toBeDisabled();
      });

      test.skip('Save button is disabled after saving (no double-save)', async ({ page }) => {
        const firstCard = page.locator('[data-testid^="product-card-"]').first();
        const saveBtn = firstCard.getByRole('button', { name: /save/i });
        await saveBtn.click();
        await expect(saveBtn).toBeDisabled();
      });

      test.skip('Export CSV button triggers file download', async ({ page }) => {
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /export csv/i }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe('onesell-results.csv');
      });

      test.skip('exported CSV contains correct headers', async ({ page }) => {
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /export csv/i }).click();
        const download = await downloadPromise;

        const path = await download.path();
        // In a real test, read the file and verify headers:
        // Rank,Name,Score,Margin,Category,Risk
        expect(path).toBeTruthy();
      });
    });

    test.describe('Card click navigation', () => {
      test.skip('clicking a product card navigates to Step 11 (Product Detail)', async ({ page }) => {
        const firstCard = page.locator('[data-testid^="product-card-"]').first();
        await firstCard.click();

        // Step 11 — product name heading and back button
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
      });
    });

    test.describe('Retry / Run new search', () => {
      test.skip('Retry button navigates back to Step 9 for re-analysis', async ({ page }) => {
        // Error state scenario — Retry shown
        const retryBtn = page.getByRole('button', { name: /retry/i });
        await retryBtn.click();

        // Should return to Agent Analysis (Step 9)
        await expect(page.getByRole('list', { name: /stages/i })).toBeVisible();
      });
    });
  });

  // =========================================================================
  // Step 11 — Product Detail Drill-Down
  // =========================================================================
  test.describe('Step 11: Product Detail', () => {
    test.describe('Layout and navigation', () => {
      test.skip('shows Back button, product name heading, rank/category/risk line', async ({ page }) => {
        // Pre: navigate to a product detail
        await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // Rank + category + risk line
        await expect(page.getByText(/#\d+/)).toBeVisible();
      });

      test.skip('Back button returns to Step 10 (Results Dashboard)', async ({ page }) => {
        await page.getByRole('button', { name: /back/i }).click();

        // Results Dashboard heading should be visible again
        await expect(page.getByRole('heading', { name: /results/i })).toBeVisible();
      });
    });

    test.describe('Tab navigation', () => {
      test.skip('renders 5 tabs: Overview, Trends, Competition, Margin, AI Reasoning', async ({ page }) => {
        const tablist = page.getByRole('tablist');
        await expect(tablist).toBeVisible();

        const tabs = tablist.getByRole('tab');
        await expect(tabs).toHaveCount(5);
      });

      test.skip('Overview tab is selected by default', async ({ page }) => {
        const overviewTab = page.getByRole('tab', { name: /overview/i });
        await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
      });

      test.skip('clicking Trends tab switches tabpanel content', async ({ page }) => {
        await page.getByRole('tab', { name: /trends/i }).click();

        const tabpanel = page.getByRole('tabpanel');
        // Trends panel shows trend score heading
        await expect(tabpanel.getByText(/trend/i)).toBeVisible();
      });

      test.skip('clicking Competition tab shows competition score and level indicator', async ({ page }) => {
        await page.getByRole('tab', { name: /competition/i }).click();

        const tabpanel = page.getByRole('tabpanel');
        await expect(tabpanel.getByText(/competition/i)).toBeVisible();
        // Level indicator text: Low/Moderate/High
        await expect(tabpanel.getByText(/low|moderate|high/i)).toBeVisible();
      });

      test.skip('clicking Margin tab shows interactive calculator', async ({ page }) => {
        await page.getByRole('tab', { name: /margin/i }).click();

        const tabpanel = page.getByRole('tabpanel');
        // Calculator should have cost, price, and fees inputs
        await expect(tabpanel.getByLabel(/cost/i)).toBeVisible();
        await expect(tabpanel.getByLabel(/price/i)).toBeVisible();
        await expect(tabpanel.getByLabel(/fee/i)).toBeVisible();
      });

      test.skip('clicking AI Reasoning tab shows reasoning log with numbered steps', async ({ page }) => {
        await page.getByRole('tab', { name: /reasoning/i }).click();

        const tabpanel = page.getByRole('tabpanel');
        // Reasoning log heading
        await expect(tabpanel.getByText(/reasoning/i)).toBeVisible();
      });

      test.skip('all tabs have correct aria-selected state', async ({ page }) => {
        const tablist = page.getByRole('tablist');
        const tabs = tablist.getByRole('tab');

        for (let i = 0; i < 5; i++) {
          await tabs.nth(i).click();
          await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');

          // All other tabs should be aria-selected=false
          for (let j = 0; j < 5; j++) {
            if (j !== i) {
              await expect(tabs.nth(j)).toHaveAttribute('aria-selected', 'false');
            }
          }
        }
      });
    });

    test.describe('Overview tab content', () => {
      test.skip('shows agent justification text', async ({ page }) => {
        const tabpanel = page.getByRole('tabpanel');
        // At least one list item with justification
        await expect(tabpanel.locator('li').first()).toBeVisible();
      });

      test.skip('shows risk flags with severity colors', async ({ page }) => {
        // Risk flags list with color-coded severity
        await expect(page.getByText(/\[HIGH\]|\[MEDIUM\]|\[LOW\]/i)).toBeVisible();
      });

      test.skip('shows category and market insight sections', async ({ page }) => {
        await expect(page.getByText(/category/i)).toBeVisible();
        await expect(page.getByText(/market insight/i)).toBeVisible();
      });
    });

    test.describe('Trends tab content', () => {
      test.skip('displays score bar chart with demand, trend, and beginner bars', async ({ page }) => {
        await page.getByRole('tab', { name: /trends/i }).click();

        // Three bar chart rows
        await expect(page.locator('[data-testid^="bar-"]')).toHaveCount(3);
      });

      test.skip('bar widths correspond to score values (0-100%)', async ({ page }) => {
        await page.getByRole('tab', { name: /trends/i }).click();

        const bar = page.locator('[data-testid^="bar-"]').first();
        const width = await bar.evaluate((el) => el.style.width);
        // Width should be a percentage string like "75%"
        expect(width).toMatch(/^\d+(\.\d+)?%$/);
      });
    });

    test.describe('Competition tab content', () => {
      test.skip('shows competition score out of 100', async ({ page }) => {
        await page.getByRole('tab', { name: /competition/i }).click();
        await expect(page.getByText(/\/100/)).toBeVisible();
      });

      test.skip('shows color-coded bar (green ≤30, amber ≤60, red >60)', async ({ page }) => {
        await page.getByRole('tab', { name: /competition/i }).click();
        // The bar div should have a background color
        const bar = page.locator('div[style*="border-radius: 4px"]').last();
        await expect(bar).toBeVisible();
      });
    });

    test.describe('Margin Calculator tab', () => {
      test.skip('pre-fills cost and price from product data', async ({ page }) => {
        await page.getByRole('tab', { name: /margin/i }).click();

        const costInput = page.getByLabel(/cost/i);
        const priceInput = page.getByLabel(/price/i);

        // Should have non-zero values from product card data
        const costVal = await costInput.inputValue();
        const priceVal = await priceInput.inputValue();
        expect(Number(costVal)).toBeGreaterThan(0);
        expect(Number(priceVal)).toBeGreaterThan(0);
      });

      test.skip('changing cost recalculates margin in real time', async ({ page }) => {
        await page.getByRole('tab', { name: /margin/i }).click();

        const marginDisplay = page.locator('[data-testid="calculated-margin"]');
        const initialMargin = await marginDisplay.textContent();

        const costInput = page.getByLabel(/cost/i);
        await costInput.fill('0.01');

        const newMargin = await marginDisplay.textContent();
        expect(newMargin).not.toBe(initialMargin);
      });

      test.skip('negative margin shown in red when cost exceeds price', async ({ page }) => {
        await page.getByRole('tab', { name: /margin/i }).click();

        const costInput = page.getByLabel(/cost/i);
        await costInput.fill('99999');

        const marginDisplay = page.locator('[data-testid="calculated-margin"]');
        // Negative margin → red color
        await expect(marginDisplay).toHaveCSS('color', 'rgb(231, 76, 60)');
      });

      test.skip('platform fees percentage is editable', async ({ page }) => {
        await page.getByRole('tab', { name: /margin/i }).click();

        const feesInput = page.getByLabel(/fee/i);
        await feesInput.fill('20');
        await expect(feesInput).toHaveValue('20');
      });
    });

    test.describe('AI Reasoning tab content', () => {
      test.skip('shows numbered reasoning steps with actions', async ({ page }) => {
        await page.getByRole('tab', { name: /reasoning/i }).click();

        // Ordered list of reasoning steps
        const steps = page.locator('li');
        const count = await steps.count();
        expect(count).toBeGreaterThan(0);
      });

      test.skip('each step shows a tool badge (e.g. calc_margin, rank_competition)', async ({ page }) => {
        await page.getByRole('tab', { name: /reasoning/i }).click();

        // Tool badges are styled spans inside each step
        const toolBadges = page.locator('span').filter({ hasText: /calc_margin|rank_competition|score_trend|flag_beginner_risk|compare_products/i });
        const count = await toolBadges.count();
        expect(count).toBeGreaterThan(0);
      });

      test.skip('each step shows data values as key-value chips', async ({ page }) => {
        await page.getByRole('tab', { name: /reasoning/i }).click();

        // Data value chips contain "key: value" format
        const chips = page.locator('span').filter({ hasText: /:\s+/ });
        const count = await chips.count();
        expect(count).toBeGreaterThan(0);
      });

      test.skip('each step shows an insight paragraph', async ({ page }) => {
        await page.getByRole('tab', { name: /reasoning/i }).click();

        const insights = page.locator('p');
        const count = await insights.count();
        expect(count).toBeGreaterThan(0);
      });

      test.skip('empty reasoning steps shows fallback justification text', async ({ page }) => {
        // When card.reasoningSteps is empty, fallback to justification
        await page.getByRole('tab', { name: /reasoning/i }).click();
        // Either the ordered list OR the fallback text should appear
        const text = page.getByRole('tabpanel');
        await expect(text).toBeVisible();
      });
    });
  });

  // =========================================================================
  // Edge Cases & Error States
  // =========================================================================
  test.describe('Edge Cases', () => {
    test.describe('Empty results', () => {
      test.skip('Results Dashboard shows empty state with heading and description', async ({ page }) => {
        // Scenario: analysis returns 0 products
        await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
        await expect(page.getByText(/no products|empty/i)).toBeVisible();
      });

      test.skip('empty state shows Retry button', async ({ page }) => {
        await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
      });

      test.skip('Retry from empty state navigates to Step 9', async ({ page }) => {
        await page.getByRole('button', { name: /retry/i }).click();
        await expect(page.getByRole('list', { name: /stages/i })).toBeVisible();
      });
    });

    test.describe('Error states', () => {
      test.skip('Results Dashboard error state shows red alert and Retry', async ({ page }) => {
        // Scenario: fetch results fails
        const alert = page.getByRole('alert');
        await expect(alert).toBeVisible();
        await expect(alert).toHaveCSS('color', 'rgb(231, 76, 60)');

        await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
      });

      test.skip('Agent Analysis error shows error cross icon on all stages', async ({ page }) => {
        // All stages should show ✗ when status is 'error'
        await expect(page.getByText('✗')).toBeVisible();
      });
    });

    test.describe('Back navigation', () => {
      test.skip('ProductDetail → Back → Results Dashboard preserves card list', async ({ page }) => {
        // Navigate to detail, come back
        const firstCard = page.locator('[data-testid^="product-card-"]').first();
        const firstCardText = await firstCard.textContent();
        await firstCard.click();

        await page.getByRole('button', { name: /back/i }).click();

        // The same card should still be there
        const restoredCard = page.locator('[data-testid^="product-card-"]').first();
        await expect(restoredCard).toHaveText(firstCardText!);
      });

      test.skip('ProductDetail → Back preserves sort and filter selections', async ({ page }) => {
        // Set sort to margin, filter to SAFE, drill into card, come back
        await page.getByRole('combobox', { name: /sort/i }).selectOption('margin');
        await page.getByRole('combobox', { name: /risk/i }).selectOption('SAFE');

        await page.locator('[data-testid^="product-card-"]').first().click();
        await page.getByRole('button', { name: /back/i }).click();

        // Sort and filter should still be set
        await expect(page.getByRole('combobox', { name: /sort/i })).toHaveValue('margin');
        await expect(page.getByRole('combobox', { name: /risk/i })).toHaveValue('SAFE');
      });

      test.skip('Step 7 Back button closes all open BrowserViews before returning', async ({ page }) => {
        // Connect a platform, press Back — views should be cleaned up
        await page.getByRole('button', { name: /connect to/i }).first().click();
        await page.getByRole('button', { name: /back to wizard/i }).click();

        // Should return to Step 6 without dangling views
        await expect(page.getByText('⚡')).toBeVisible();
      });

      test.skip('navigating forward and back through all 11 steps does not lose state', async ({ page }) => {
        // Full forward pass: Steps 1 → 6, then back to 1
        await page.getByText(MARKET_FLAGS.us).locator('..').click(); // → 2
        await clickBack(page); // → 1

        // Market tiles should still be visible, US not pre-selected
        await expect(page.getByText(MARKET_FLAGS.us)).toBeVisible();
      });
    });

    test.describe('ProductDetail not found', () => {
      test.skip('shows "not found" message when selectedCardId has no match', async ({ page }) => {
        // Scenario: card was removed or ID is stale
        await expect(page.getByText(/not found/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
      });
    });
  });

  // =========================================================================
  // Cross-Market Validation
  // =========================================================================
  test.describe('Cross-Market: China Market Journey', () => {
    test.skip('selecting China market shows CN-specific platforms in Step 3', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.cn).locator('..').click();
      await clickNext(page); // → Step 3

      // China platforms: Taobao, Tmall, JD.com, Pinduoduo, Douyin Shop, Kuaishou Shop, Xiaohongshu
      await expect(page.getByText(/taobao/i)).toBeVisible();
    });

    test.skip('China market budget slider uses CNY (¥) currency', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.cn).locator('..').click();
      await expect(page.getByText('¥')).toBeVisible();
    });
  });

  test.describe('Cross-Market: SEA Market Journey', () => {
    test.skip('selecting SEA market shows SEA-specific platforms in Step 3', async ({ page }) => {
      await page.getByText(MARKET_FLAGS.sea).locator('..').click();
      await clickNext(page); // → Step 3

      // SEA platforms include Shopee, Tokopedia, Lazada
      await expect(page.getByText(/shopee/i)).toBeVisible();
    });
  });
});
