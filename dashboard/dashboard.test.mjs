/**
 * parseApplications() 단위 테스트
 * 실행: node dashboard/dashboard.test.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// parser.js를 읽고 Function으로 실행하여 글로벌 함수를 가져옴
const parserCode = readFileSync(join(__dirname, 'parser.js'), 'utf-8');
const parserFn = new Function(parserCode + '\nreturn { parseApplications, STATUS_MAP };');
const { parseApplications, STATUS_MAP } = parserFn();

// Test runner
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// Test 1: Valid table
console.log('Test: valid table parsing');
const validInput = `# 지원 현황

| # | 기업 | 직무 | 점수 | 상태 | 날짜 | 보고서 | URL | 비고 |
|---|------|------|------|------|------|--------|-----|------|
| 001 | 카카오 | Product Manager | 4.3 | 평가완료 | 2026-04-07 | reports/001.md | https://example.com | Growth PM |
| 002 | 토스 | PM, 토스페이 | 3.8 | 지원완료 | 2026-04-07 | reports/002.md | https://example.com | B2B PM |`;

const result = parseApplications(validInput);
assert(result.length === 2, 'should parse 2 rows');
assert(result[0].company === '카카오', 'first row company = 카카오');
assert(result[0].score === 4.3, 'first row score = 4.3');
assert(result[0].statusKey === 'evaluated', 'first row statusKey = evaluated');
assert(result[1].statusKey === 'applied', 'second row statusKey = applied');
assert(result[0].note === 'Growth PM', 'first row note = Growth PM');

// Test 2: Empty input
console.log('Test: empty input');
assert(parseApplications('').length === 0, 'should return empty array');

// Test 3: Header only
console.log('Test: header only');
const headerOnly = `| # | 기업 | 직무 | 점수 | 상태 | 날짜 | 보고서 | URL | 비고 |
|---|------|------|------|------|------|--------|-----|------|`;
assert(parseApplications(headerOnly).length === 0, 'should return empty array for header-only');

// Test 4: Malformed lines
console.log('Test: malformed lines');
assert(parseApplications('| 001 | 카카오 | PM |').length === 0, 'should skip lines with < 8 columns');

// Test 5: Non-numeric score
console.log('Test: non-numeric score');
const badScore = `| 001 | 카카오 | PM | N/A | 평가완료 | 2026-04-07 | reports/001.md | https://example.com | |`;
assert(parseApplications(badScore).length === 0, 'should skip rows with non-numeric score');

// Test 6: Unknown status
console.log('Test: unknown status fallback');
const unknownStatus = `| 001 | 카카오 | PM | 4.0 | 알수없음 | 2026-04-07 | reports/001.md | https://example.com | |`;
const unknownResult = parseApplications(unknownStatus);
assert(unknownResult.length === 1, 'should parse row with unknown status');
assert(unknownResult[0].statusKey === 'evaluated', 'unknown status maps to evaluated');

// Test 7: All valid statuses
console.log('Test: all valid statuses');
assert(Object.keys(STATUS_MAP).length === 8, 'STATUS_MAP has 8 entries');
assert(STATUS_MAP['회신'] === 'responded', '회신 maps to responded');
assert(STATUS_MAP['포기'] === 'discarded', '포기 maps to discarded');

// Summary
console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
