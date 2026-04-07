#!/usr/bin/env node

/**
 * career-ops-kr 포털 스캐너
 * Playwright + stealth 기법으로 채용 사이트를 스캔합니다.
 * gstack browse 의존성 없이 독립적으로 동작합니다.
 *
 * 사용법:
 *   node scan-portal.mjs --url "https://toss.im/career/jobs" --keyword "프로덕트"
 *   node scan-portal.mjs --url "https://career.rememberapp.co.kr/job/postings" --keyword "PM"
 *   node scan-portal.mjs --list portals.yml
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Stealth 설정 ---
// gstack browse가 리멤버 등에서 성공한 핵심 기법을 재현합니다.

const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-infobars',
  '--no-first-run',
  '--no-default-browser-check',
];

const STEALTH_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function createStealthBrowser() {
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
    const originalQuery = window.navigator.permissions.query;
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

// --- 포털 스캔 ---

async function scanPortal(url, keywords, timeout = 15000) {
  const { browser, context } = await createStealthBrowser();
  const results = { url, status: 'unknown', jobs: [], error: null };

  try {
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });

    const httpStatus = response?.status() || 0;

    if (httpStatus === 403 || httpStatus === 429) {
      results.error = `HTTP ${httpStatus} - 접근 차단됨`;
      results.status = httpStatus;
      return results;
    }

    // SPA 로딩 대기 (콘텐츠가 렌더링될 때까지)
    await page.waitForTimeout(5000);

    // 모든 텍스트 콘텐츠에서 채용 공고 추출
    const pageText = await page.evaluate(() => {
      // 링크 요소에서 직무 정보 추출
      const links = [...document.querySelectorAll('a')];
      return links.map(a => ({
        text: (a.textContent || '').trim().replace(/\s+/g, ' '),
        href: a.href,
      })).filter(l => l.text.length > 5 && l.text.length < 200);
    });

    // 키워드 매칭
    const positiveKeywords = keywords.positive || [
      '프로덕트 매니저', '프로덕트매니저', 'Product Manager',
      'Product Owner', '프로덕트 오너',
      '서비스기획', '서비스 기획', '프로덕트 기획',
    ];
    // "PM", "PO"는 단독 매칭 시 오탐 많음 → 복합 키워드로만 매칭
    const compoundKeywords = ['PM/PO', 'PM ・', 'PO ・', 'Product Owner', 'Product Manager'];

    const negativeKeywords = keywords.negative || [
      '인턴', 'intern', 'Project Manager',
      '파트타임', '계약직', '아르바이트',
    ];

    for (const link of pageText) {
      const text = link.text;
      const matchesPositive = positiveKeywords.some(kw =>
        text.toLowerCase().includes(kw.toLowerCase())
      ) || compoundKeywords.some(kw => text.includes(kw));
      const matchesNegative = negativeKeywords.some(kw =>
        text.toLowerCase().includes(kw.toLowerCase())
      );

      if (matchesPositive && !matchesNegative) {
        results.jobs.push({
          title: text.slice(0, 100),
          url: link.href,
        });
      }
    }

    results.status = 'success';
  } catch (err) {
    results.error = err.message;
    results.status = 'error';
  } finally {
    await browser.close();
  }

  return results;
}

// --- CLI ---

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const keywordIdx = args.indexOf('--keyword');

if (urlIdx === -1) {
  console.log('사용법:');
  console.log('  node scan-portal.mjs --url <채용페이지URL> [--keyword <키워드>]');
  console.log('');
  console.log('예시:');
  console.log('  node scan-portal.mjs --url "https://toss.im/career/jobs" --keyword "프로덕트"');
  console.log('  node scan-portal.mjs --url "https://career.rememberapp.co.kr/job/postings"');
  process.exit(0);
}

const targetUrl = args[urlIdx + 1];
const keyword = keywordIdx !== -1 ? args[keywordIdx + 1] : null;

const keywords = {
  positive: keyword
    ? [keyword]
    : ['프로덕트 매니저', '프로덕트매니저', 'Product Manager', 'PM', 'PO', '서비스기획'],
  negative: ['인턴', 'intern', 'Project Manager', '파트타임', '계약직'],
};

console.log(`스캔 중: ${targetUrl}`);
if (keyword) console.log(`키워드: ${keyword}`);

const result = await scanPortal(targetUrl, keywords);

if (result.error) {
  console.error(`오류: ${result.error}`);
  process.exit(1);
}

console.log(`상태: ${result.status}`);
console.log(`발견한 PM 공고: ${result.jobs.length}건`);

if (result.jobs.length > 0) {
  console.log('');
  result.jobs.forEach((job, i) => {
    console.log(`  ${i + 1}. ${job.title}`);
    console.log(`     ${job.url}`);
  });
}

// JSON 출력 (파이프라인 연동용)
if (args.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
}
