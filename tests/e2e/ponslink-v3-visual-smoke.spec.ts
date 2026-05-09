import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const ARTIFACT_DIR = path.join(process.cwd(), '.omx/artifacts/visual-ralph/ponslink-v3/e2e-smoke');

const authSession = {
  userId: 'host-1',
  providerSubject: 'google-oauth2|host-1',
  email: 'host@example.com',
  displayName: 'Declan Park',
  primaryAlias: 'declan',
  uniqueNumber: '84520193',
  sessionToken: 'visual-token',
  loggedInAt: '2026-05-06T02:04:00.000Z',
};

const routeLoungeProfile = async (page: Page) => {
  await page.route('http://127.0.0.1:6650/api/lounge/profile**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          userId: authSession.userId,
          email: authSession.email,
          displayName: authSession.displayName,
          providerSubject: authSession.providerSubject,
          primaryAlias: authSession.primaryAlias,
          uniqueNumber: authSession.uniqueNumber,
        },
        accountProfile: {
          userId: authSession.userId,
          displayName: authSession.displayName,
          statusMessage: 'Open for product reviews and mentoring',
        },
        publicProfile: {
          userId: authSession.userId,
          slug: authSession.primaryAlias,
          headline: 'Focused calls for product builders',
          bio: 'I help teams clarify product scope, room setup, and collaboration rituals before a live session.',
          responsePolicy: 'approve_before_booking',
          defaultRoomType: 'video-one-to-one',
          timezone: 'Asia/Seoul',
          profileVisibility: 'public',
          allowGeneralRequest: true,
          allowScheduleRequest: true,
          allowMentoringRequest: true,
          allowCollabRequest: true,
        },
      }),
    });
  });
};

const routeBookingDetail = async (page: Page) => {
  await page.route('http://127.0.0.1:6650/api/lounge/reservations/booking-1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'booking-1',
        requestId: 'request-1',
        hostUserId: authSession.userId,
        guestDisplayName: 'Mina Kim',
        guestEmail: 'mina@example.com',
        roomType: 'video-one-to-one',
        scheduledStartAt: '2026-05-08T10:00:00.000+09:00',
        scheduledEndAt: '2026-05-08T10:45:00.000+09:00',
        timezone: 'Asia/Seoul',
        status: 'confirmed',
        joinUrl: '/room/declan?c_id=45#demo',
      }),
    });
  });
  await page.route('http://127.0.0.1:6650/api/lounge/bookings/booking-1', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'fallback unused' }) });
  });
};

test.beforeEach(async ({ page }) => {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await page.addInitScript((session) => {
    localStorage.setItem('ponslink:personal-link:auth-session', JSON.stringify(session));
    localStorage.setItem('ponslink:cookie-consent', 'accepted');
  }, authSession);
});

const joinVisualRoom = async (page: Page) => {
  await page.goto('/join/Visual%20Room?type=video-group');
  await page.getByPlaceholder('Enter nickname').fill('Visual Host');
  await page.getByRole('button', { name: /Enter lounge|Join/i }).click();
  await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible();
};

const openMoreRoomControl = async (page: Page, label: string) => {
  await page.getByRole('button', { name: 'Open more room controls' }).click();
  await page.getByRole('menuitem', { name: label }).click();
};

test('keeps the v3 lounge profile, onboarding, and booking detail surfaces visually stable', async ({ page }) => {
  await routeLoungeProfile(page);
  await routeBookingDetail(page);

  await page.goto('/lounge/profile');
  await expect(page.getByRole('heading', { name: 'Lounge profile' })).toBeVisible();
  await expect(page.getByTestId('lounge-profile-shell')).toHaveAttribute('data-tone', 'lounge-light');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'lounge-profile.png'), fullPage: true });

  await page.goto('/lounge/onboarding');
  await expect(page.getByRole('heading', { name: 'Basic Info' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 250, 252)');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'lounge-onboarding.png'), fullPage: true });

  await page.goto('/lounge/bookings/booking-1');
  await expect(page.getByRole('heading', { name: 'Mina Kim' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Session operations' })).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'lounge-booking-detail.png'), fullPage: true });
});

test('opens the room chat panel on the dark v3 room surface', async ({ page }) => {
  await joinVisualRoom(page);

  await page.getByRole('button', { name: 'Open chat' }).click();
  await expect(page.getByRole('dialog', { name: 'Room chat panel' })).toBeVisible();
  await expect(page.locator('.room-noir-panel').first()).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'room-chat-panel.png'), fullPage: true });
});

test('opens the remaining v3 room support panels on the dark room surface', async ({ page }) => {
  await joinVisualRoom(page);

  await page.getByRole('button', { name: 'Open media relay panel' }).click();
  await expect(page.getByRole('dialog', { name: 'Media relay control panel' })).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'room-relay-panel.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close media relay panel' }).click();

  await page.getByRole('button', { name: 'Open CoWatch panel' }).click();
  await expect(page.getByRole('textbox', { name: 'YouTube link for CoWatch' })).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'room-cowatch-panel.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close CoWatch panel' }).click({ force: true });

  await openMoreRoomControl(page, 'Whiteboard');
  await expect(page.getByText('Collaborative Whiteboard')).toBeVisible();
  await expect(page.locator('.whiteboard-panel')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'room-whiteboard-panel.png'), fullPage: true });
  await page.getByTitle('Close (Esc)').click();

  await openMoreRoomControl(page, 'Settings');
  await expect(page.getByRole('dialog', { name: 'Room Settings' })).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'room-settings-panel.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close settings panel' }).click();

  await openMoreRoomControl(page, 'PonsCast');
  await expect(page.getByRole('heading', { name: 'PonsCast' })).toBeVisible();
  await expect(page.locator('.ponscast-stage')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'room-ponscast-panel.png'), fullPage: true });
});
