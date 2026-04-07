#!/usr/bin/env node

/**
 * URL 유효성 검증기
 * WebSearch(Tier 2)로 발견한 채용 공고 URL이 살아있는지 확인합니다.
 *
 * 사용법:
 *   echo '[{"title":"PM","url":"https://...","company":"쿠팡"}]' | node validate-urls.mjs --json
 *   node validate-urls.mjs --input /tmp/jobs.json --browser --json
 */

import { createStealthBrowser, STEALTH_USER_AGENT } from './lib/browser.mjs';
import { readFileSync, existsSync } from 'fs';

const TIMEOUT_MS = 10000;
const DOMAIN_DELAY_MS = 1000;
const MAX_CONCURRENT_DOMAINS = 3;

const DEAD_PAGE_PATTERNS = [
  'error 404', 'not found', 'page not found',
  '페이지를 찾을 수 없습니다', '존재하지 않는 페이지',
  'this job is no longer available', 'job not found',
  'the position has been filled', '채용이 마감',
];

// --- HTTP HEAD 검증 ---

async function validateWithHttp(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': STEALTH_USER_AGENT,
        'Accept': 'text/html',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    return {
      status: res.status,
      finalUrl: res.url,
      ok: res.ok,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: 0, finalUrl: url, ok: false, error: 'timeout' };
    }
    return { status: 0, finalUrl: url, ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// --- Playwright 브라우저 검증 ---

async function validateWithBrowser(url, page, deadPatterns = [], timeoutMs = TIMEOUT_MS) {
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    const httpStatus = response?.status() || 0;
    const finalUrl = page.url();

    if (httpStatus === 404 || httpStatus === 410) {
      return { status: httpStatus, finalUrl, dead: true, reason: `HTTP ${httpStatus}` };
    }

    // SPA 콘텐츠 로딩 대기
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const pageText = await page.evaluate(() => {
      const title = document.title || '';
      const body = document.body?.innerText?.slice(0, 900) || '';
      return (title + ' ' + body).toLowerCase();
    });

    const allPatterns = [...DEAD_PAGE_PATTERNS, ...deadPatterns.map(p => p.toLowerCase())];
    const matchedPattern = allPatterns.find(p => pageText.includes(p));

    if (matchedPattern) {
      return { status: httpStatus, finalUrl, dead: true, reason: `콘텐츠 패턴: "${matchedPattern}"` };
    }

    return { status: httpStatus, finalUrl, dead: false };
  } catch (err) {
    const msg = err.message.split('\n')[0];
    const isDefinitelyDead = msg.includes('ERR_NAME_NOT_RESOLVED')
      || msg.includes('ERR_CONNECTION_REFUSED');
    return {
      status: 0,
      finalUrl: url,
      dead: isDefinitelyDead,
      reason: isDefinitelyDead ? `DNS/연결 실패: ${msg}` : undefined,
      error: isDefinitelyDead ? undefined : msg,
    };
  }
}

// --- 홈페이지 리다이렉트 감지 ---

function isHomepageRedirect(originalUrl, finalUrl) {
  try {
    const orig = new URL(originalUrl);
    const final = new URL(finalUrl);

    if (orig.hostname !== final.hostname) return false;

    // 원래 URL이 구체적인 경로를 가졌는데 최종 URL이 루트로 갔으면 리다이렉트
    const origPath = orig.pathname.replace(/\/$/, '');
    const finalPath = final.pathname.replace(/\/$/, '');

    if (origPath === finalPath) return false;

    // 최종 경로가 포털 루트 패턴인지 확인
    const rootPatterns = ['', '/jobs', '/en/jobs', '/career', '/career/jobs', '/careers', '/recruit'];
    return rootPatterns.includes(finalPath);
  } catch {
    return false;
  }
}

// --- 도메인별 속도 제어 ---

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function groupByDomain(jobs) {
  const groups = new Map();
  const malformed = [];
  for (const job of jobs) {
    try {
      const domain = new URL(job.url).hostname;
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain).push(job);
    } catch {
      malformed.push(job);
    }
  }
  return { groups, malformed };
}

// --- 포털 설정 로드 ---

function loadPortalConfig() {
  const portalsPath = new URL('./portals.yml', import.meta.url).pathname;
  if (!existsSync(portalsPath)) return new Map();

  try {
    const content = readFileSync(portalsPath, 'utf-8');
    const config = new Map();

    // 간단한 YAML 파싱: requires_browser_validation과 dead_link_patterns 추출
    let currentDomain = null;
    let inDeadPatterns = false;

    for (const line of content.split('\n')) {
      const nameMatch = line.match(/^\s+-\s+name:\s+(.+)/);
      if (nameMatch) {
        currentDomain = null;
        inDeadPatterns = false;
        continue;
      }

      const urlMatch = line.match(/^\s+careers_url:\s+(.+)/);
      if (urlMatch) {
        try {
          const domain = new URL(urlMatch[1].trim()).hostname;
          currentDomain = domain;
          if (!config.has(domain)) {
            config.set(domain, { requiresBrowser: false, deadPatterns: [] });
          }
        } catch { /* skip */ }
      }

      if (line.match(/^\s+requires_browser_validation:\s+true/) && currentDomain) {
        config.get(currentDomain).requiresBrowser = true;
      }

      if (line.match(/^\s+dead_link_patterns:/)) {
        inDeadPatterns = true;
        continue;
      }

      if (inDeadPatterns) {
        const patternMatch = line.match(/^\s+-\s+(?:"(.+)"|'(.+)'|(.+))/);
        if (patternMatch && currentDomain) {
          const pattern = (patternMatch[1] ?? patternMatch[2] ?? patternMatch[3]).trim();
          config.get(currentDomain).deadPatterns.push(pattern);
        } else if (line.match(/^\S/) || line.match(/^\s+\w+:/)) {
          inDeadPatterns = false;
        }
      }
    }

    return config;
  } catch {
    return new Map();
  }
}

// --- 메인 검증 ---

async function validateUrls(jobs, options = {}) {
  const { useBrowser = false, concurrency = MAX_CONCURRENT_DOMAINS } = options;
  const portalConfig = loadPortalConfig();

  const valid = [];
  const invalid = [];
  const uncertain = [];

  const { groups: domainGroups, malformed } = groupByDomain(jobs);
  for (const job of malformed) {
    invalid.push({
      ...job,
      validation_status: 'dead',
      http_status: 0,
      reason: '잘못된 URL 형식',
      validated_at: Date.now(),
    });
  }
  const domains = [...domainGroups.keys()];

  // 도메인을 concurrency만큼 동시 처리
  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);

    await Promise.all(batch.map(async (domain) => {
      const domainJobs = domainGroups.get(domain);
      const config = portalConfig.get(domain) || { requiresBrowser: false, deadPatterns: [] };
      const needsBrowser = useBrowser || config.requiresBrowser;

      let browser = null;
      let context = null;
      let page = null;

      if (needsBrowser) {
        try {
          ({ browser, context } = await createStealthBrowser());
          page = await context.newPage();
        } catch (err) {
          // 브라우저 시작 실패 시 모든 URL을 uncertain으로
          for (const job of domainJobs) {
            uncertain.push({
              ...job,
              validation_status: 'blocked',
              http_status: 0,
              reason: `브라우저 시작 실패: ${err.message}`,
              validated_at: Date.now(),
            });
          }
          return;
        }
      }

      try {
        for (let j = 0; j < domainJobs.length; j++) {
          const job = domainJobs[j];

          // 도메인 내 요청 간 딜레이
          if (j > 0) await delay(DOMAIN_DELAY_MS);

          let result;

          if (needsBrowser && page) {
            // Playwright 검증
            result = await validateWithBrowser(job.url, page, config.deadPatterns);

            if (result.dead) {
              invalid.push({
                ...job,
                validation_status: 'dead',
                http_status: result.status,
                reason: result.reason,
                validated_at: Date.now(),
              });
              continue;
            }

            if (isHomepageRedirect(job.url, result.finalUrl)) {
              invalid.push({
                ...job,
                validation_status: 'dead',
                http_status: result.status,
                reason: '홈페이지 리다이렉트',
                validated_at: Date.now(),
              });
              continue;
            }

            if (result.error) {
              uncertain.push({
                ...job,
                validation_status: 'blocked',
                http_status: 0,
                reason: result.error,
                validated_at: Date.now(),
              });
              continue;
            }

            valid.push({
              ...job,
              validation_status: 'valid',
              http_status: result.status,
              reason: null,
              validated_at: Date.now(),
            });
          } else {
            // HTTP HEAD 검증
            result = await validateWithHttp(job.url);

            if (result.status === 404 || result.status === 410) {
              invalid.push({
                ...job,
                validation_status: 'dead',
                http_status: result.status,
                reason: `HTTP ${result.status}`,
                validated_at: Date.now(),
              });
              continue;
            }

            if (isHomepageRedirect(job.url, result.finalUrl)) {
              invalid.push({
                ...job,
                validation_status: 'dead',
                http_status: result.status,
                reason: '홈페이지 리다이렉트',
                validated_at: Date.now(),
              });
              continue;
            }

            if (result.status === 403 || result.status === 503) {
              uncertain.push({
                ...job,
                validation_status: 'blocked',
                http_status: result.status,
                reason: `HTTP ${result.status} (접근 차단 가능성)`,
                validated_at: Date.now(),
              });
              continue;
            }

            if (result.error === 'timeout' || result.status === 0) {
              uncertain.push({
                ...job,
                validation_status: 'timeout',
                http_status: 0,
                reason: result.error || '타임아웃',
                validated_at: Date.now(),
              });
              continue;
            }

            if (result.ok) {
              valid.push({
                ...job,
                validation_status: 'valid',
                http_status: result.status,
                reason: null,
                validated_at: Date.now(),
              });
            } else {
              uncertain.push({
                ...job,
                validation_status: 'unknown',
                http_status: result.status,
                reason: `HTTP ${result.status}`,
                validated_at: Date.now(),
              });
            }
          }
        }
      } finally {
        if (browser) await browser.close();
      }
    }));
  }

  return { valid, invalid, uncertain };
}

// --- CLI ---

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const useBrowser = args.includes('--browser');

  let input;

  const inputIdx = args.indexOf('--input');
  if (inputIdx !== -1 && args[inputIdx + 1]) {
    input = readFileSync(args[inputIdx + 1], 'utf-8');
  } else {
    // stdin에서 읽기
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString('utf-8');
  }

  let jobs;
  try {
    jobs = JSON.parse(input);
  } catch (err) {
    console.error('입력 JSON 파싱 실패:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(jobs) || jobs.length === 0) {
    console.error('검증할 URL이 없습니다.');
    process.exit(0);
  }

  if (!jsonOutput) {
    console.log(`검증 시작: ${jobs.length}건`);
  }

  const result = await validateUrls(jobs, { useBrowser });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n검증 완료:`);
    console.log(`  ✅ 유효: ${result.valid.length}건`);
    console.log(`  ❌ 마감: ${result.invalid.length}건`);
    if (result.invalid.length > 0) {
      for (const job of result.invalid) {
        console.log(`     - [${job.company}] ${job.title} (${job.reason})`);
      }
    }
    console.log(`  ⚠️  확인 필요: ${result.uncertain.length}건`);
    if (result.uncertain.length > 0) {
      for (const job of result.uncertain) {
        console.log(`     - [${job.company}] ${job.title} (${job.reason})`);
      }
    }
  }
}

main().catch((err) => {
  console.error('예기치 않은 오류:', err.message);
  process.exit(1);
});
