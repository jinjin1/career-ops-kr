/**
 * 공유 stealth 브라우저 설정
 * scan-portal.mjs, validate-urls.mjs에서 공통으로 사용합니다.
 */

import { chromium } from 'playwright';

export const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-infobars',
  '--no-first-run',
  '--no-default-browser-check',
];

export const STEALTH_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

export async function createStealthBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: STEALTH_ARGS,
  });

  const context = await browser.newContext({
    userAgent: STEALTH_USER_AGENT,
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  // webdriver 플래그 숨기기
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // chrome.runtime 추가 (자동화 탐지 우회)
    window.chrome = { runtime: {} };
    // permissions 쿼리 오버라이드
    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
    // plugins 배열 (빈 배열이면 봇으로 탐지)
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // languages (빈 배열이면 봇으로 탐지)
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });
  });

  return { browser, context };
}
