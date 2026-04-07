const path = require('path');
const { CONFIG } = require('./config');
const { safeWait } = require('./playwright-helpers');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function closeAccuratePages(ctx, preferredPage) {
  const pages = ctx.pages();

  for (const page of pages) {
    if (preferredPage && page === preferredPage) continue;

    const url = page.url();
    if (url.includes('accurate.id')) {
      await page.close().catch(() => {});
    }
  }

  if (preferredPage && !preferredPage.isClosed()) {
    return preferredPage;
  }

  return ctx.pages().find((page) => !page.isClosed()) || (await ctx.newPage());
}

async function openGoogleDriveFromSearch(page) {
  console.log('Opening Google Search for Google Drive...');
  await page.goto('https://www.google.com/search?q=Google+Drive', { waitUntil: 'domcontentloaded' });
  await safeWait(page, 3000);

  const driveResultLocators = [
    page.locator('a[href*="drive.google.com"]').first(),
    page.getByRole('link', { name: /Google Drive/i }).first(),
  ];

  let clicked = false;
  for (const locator of driveResultLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.click({ timeout: 5000 }).catch(() => {});
    clicked = true;
    break;
  }

  if (!clicked) {
    await page.goto('https://drive.google.com/drive/my-drive', { waitUntil: 'domcontentloaded' });
  }

  await waitForGoogleDrive(page);
}

async function waitForGoogleDrive(page) {
  const timeoutMs = 180000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const url = page.url();

    if (url.includes('drive.google.com')) {
      await safeWait(page, 4000);
      return;
    }

    if (url.includes('accounts.google.com')) {
      console.log('Google login required. Complete login in the browser, then the script will continue.');
    }

    await safeWait(page, 1000);
  }

  throw new Error('Timed out waiting for Google Drive to open.');
}

async function searchForFolder(page, folderName) {
  const searchLocators = [
    page.locator('input[aria-label*="Search in Drive"]').first(),
    page.locator('input[aria-label*="Search"]').first(),
    page.locator('input[placeholder*="Search"]').first(),
  ];

  for (const locator of searchLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.click().catch(() => {});
    await safeWait(page, 200);
    await locator.fill('').catch(() => {});
    await locator.fill(folderName).catch(() => {});
    await safeWait(page, 200);
    await page.keyboard.press('Enter').catch(() => {});
    await safeWait(page, 3000);
    return true;
  }

  return false;
}

async function clearDriveSearch(page) {
  const clearButton = page.locator('[aria-label*="Clear search"]').first();
  if (await clearButton.isVisible().catch(() => false)) {
    await clearButton.click().catch(() => {});
    await safeWait(page, 2000);
    return;
  }

  await page.goto('https://drive.google.com/drive/my-drive', { waitUntil: 'domcontentloaded' });
  await safeWait(page, 3000);
}

async function openExistingFolder(page, folderName) {
  const exactFolder = new RegExp(`^\\s*${escapeRegExp(folderName)}\\s*$`);
  const folderLocators = [
    page.getByText(exactFolder).first(),
    page.locator('[role="gridcell"]').filter({ hasText: exactFolder }).first(),
    page.locator('[role="main"]').getByText(exactFolder).first(),
  ];

  for (const locator of folderLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.dblclick({ timeout: 5000 }).catch(() => {});
    await safeWait(page, 2500);
    if (page.url().includes('/folders/') || (await isInsideFolder(page, folderName))) {
      console.log(`Using existing Google Drive folder: ${folderName}`);
      return true;
    }

    await locator.click({ timeout: 5000 }).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await safeWait(page, 2500);
    if (page.url().includes('/folders/') || (await isInsideFolder(page, folderName))) {
      console.log(`Using existing Google Drive folder: ${folderName}`);
      return true;
    }
  }

  return false;
}

async function isInsideFolder(page, folderName) {
  const breadcrumb = page.locator('[aria-label*="Breadcrumb"]').getByText(new RegExp(escapeRegExp(folderName), 'i')).first();
  return breadcrumb.isVisible().catch(() => false);
}

async function createNewFolder(page, folderName) {
  console.log(`Creating Google Drive folder: ${folderName}`);

  const newButtonLocators = [
    page.getByRole('button', { name: /^New$/i }).first(),
    page.locator('[guidedhelpid="new_menu_button"]').first(),
    page.locator('button[aria-label*="New"]').first(),
  ];

  let clickedNew = false;
  for (const locator of newButtonLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.click({ timeout: 5000 }).catch(() => {});
    clickedNew = true;
    break;
  }

  if (!clickedNew) {
    throw new Error('Could not open Google Drive "New" menu.');
  }

  await safeWait(page, 1000);

  const folderMenuLocators = [
    page.getByText(/^New folder$/i).first(),
    page.getByText(/^Folder$/i).first(),
    page.locator('[role="menuitem"]').filter({ hasText: /folder/i }).first(),
  ];

  let clickedFolderMenu = false;
  for (const locator of folderMenuLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.click({ timeout: 5000 }).catch(() => {});
    clickedFolderMenu = true;
    break;
  }

  if (!clickedFolderMenu) {
    throw new Error('Could not click Google Drive folder creation menu.');
  }

  await safeWait(page, 1500);

  const nameInputLocators = [
    page.locator('[role="dialog"] input[type="text"]').first(),
    page.locator('input[aria-label*="Name"]').first(),
    page.locator('input[type="text"]').last(),
  ];

  let filled = false;
  for (const locator of nameInputLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.fill(folderName).catch(() => {});
    filled = true;
    break;
  }

  if (!filled) {
    throw new Error('Could not fill Google Drive folder name.');
  }

  const createButtonLocators = [
    page.getByRole('button', { name: /^Create$/i }).first(),
    page.getByRole('button', { name: /^OK$/i }).first(),
    page.locator('[role="dialog"] button').filter({ hasText: /create|ok/i }).first(),
  ];

  let clickedCreate = false;
  for (const locator of createButtonLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.click({ timeout: 5000 }).catch(() => {});
    clickedCreate = true;
    break;
  }

  if (!clickedCreate) {
    await page.keyboard.press('Enter').catch(() => {});
  }

  await safeWait(page, 3000);

  const createdFolderLocator = page.getByText(new RegExp(`^\\s*${escapeRegExp(folderName)}\\s*$`)).first();
  if (await createdFolderLocator.isVisible().catch(() => false)) {
    await createdFolderLocator.dblclick({ timeout: 5000 }).catch(() => {});
    await safeWait(page, 2500);
  }
}

async function ensureDriveFolder(page, folderName) {
  await page.goto('https://drive.google.com/drive/my-drive', { waitUntil: 'domcontentloaded' });
  await safeWait(page, 3000);

  await searchForFolder(page, folderName);
  const found = await openExistingFolder(page, folderName);
  if (found) {
    return;
  }

  await clearDriveSearch(page);
  await createNewFolder(page, folderName);
}

async function uploadFileInDriveFolder(page, filePath) {
  console.log(`Uploading file to Google Drive folder: ${path.basename(filePath)}`);

  const newButtonLocators = [
    page.getByRole('button', { name: /^New$/i }).first(),
    page.locator('[guidedhelpid="new_menu_button"]').first(),
    page.locator('button[aria-label*="New"]').first(),
  ];

  let clickedNew = false;
  for (const locator of newButtonLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    await locator.click({ timeout: 5000 }).catch(() => {});
    clickedNew = true;
    break;
  }

  if (!clickedNew) {
    throw new Error('Could not open Google Drive "New" menu for upload.');
  }

  await safeWait(page, 1000);

  const uploadMenuLocators = [
    page.getByText(/^File upload$/i).first(),
    page.locator('[role="menuitem"]').filter({ hasText: /file upload/i }).first(),
  ];

  let chooser = null;
  for (const locator of uploadMenuLocators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;

    try {
      [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        locator.click({ timeout: 5000 }),
      ]);
      break;
    } catch {}
  }

  if (!chooser) {
    throw new Error('Could not trigger Google Drive file upload chooser.');
  }

  await chooser.setFiles(filePath);
  await safeWait(page, 5000);

  const fileName = path.basename(filePath);
  const fileVisible = await page.getByText(new RegExp(escapeRegExp(fileName), 'i')).first().isVisible().catch(() => false);
  if (fileVisible) {
    console.log(`Google Drive upload finished: ${fileName}`);
    return;
  }

  console.log(`Google Drive upload started: ${fileName}`);
}

async function uploadFileViaGoogleDriveBrowser(ctx, landingPage, filePath) {
  const page = await closeAccuratePages(ctx, landingPage);
  await openGoogleDriveFromSearch(page);
  await ensureDriveFolder(page, CONFIG.googleDriveFolderName);
  await uploadFileInDriveFolder(page, filePath);
}

module.exports = {
  uploadFileViaGoogleDriveBrowser,
};
