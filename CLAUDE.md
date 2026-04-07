# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

한국 PM/PO 구직자를 위한 AI 구직 파이프라인. Claude Code 스킬(`/career-ops-kr`)로 동작하며, 채용 공고 스캔, 평가, 맞춤 이력서/경력기술서 생성을 자동화합니다.

## 명령어

```bash
npm test              # 단위 테스트 (dashboard/dashboard.test.mjs)
npm run scan          # 포털 스캔 (node scan-portal.mjs --url <URL>)
npm run pdf           # PDF 생성 (node generate-pdf.mjs --input <html> --output <pdf>)
npm run setup         # Playwright + Pretendard 폰트 설치
npm run fonts         # 폰트만 다운로드
npm run dashboard     # 대시보드 로컬 서버 (npx serve dashboard)
```

## 핵심 원칙

1. **절대 지원서를 자동 제출하지 않습니다.** 양식을 채울 수 있지만, 제출 전에 반드시 멈춥니다.
2. **경력/성과를 조작하지 않습니다.** cv.md와 career-description.md에 있는 경험만 사용합니다.
3. **낮은 점수(3.0 미만) 공고 지원을 강력히 비추천합니다.**
4. **git push 전에 반드시 사용자 승인을 받습니다.** 커밋 내용을 보여주고 push 여부를 확인합니다.
5. **모든 데이터는 cv.md, career-description.md에서 런타임에 읽습니다.** 하드코딩 금지.
6. **사람이 결정합니다.** AI는 평가하고 추천하되, 최종 결정은 사용자 몫입니다.

## 아키텍처

```
사용자 입력 → SKILL.md(라우터) → modes/*.md(10개 모드) + _shared.md(공유 설정)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
               data/*.md       reports/*.md     output/*.pdf
                    │
                    ▼
              dashboard/ (HTML/JS 시각화)
```

**스킬 라우팅**: `.claude/skills/career-ops-kr/SKILL.md`가 사용자 입력(URL/명령어/텍스트)을 파싱하여 적절한 모드 파일로 라우팅합니다. 모든 모드는 `modes/_shared.md`를 먼저 로드합니다.

**10개 모드**: setup, scan, evaluate, pdf, career-desc, cover-letter, pipeline, tracker, contact, deep. 각 모드는 사전 조건, 실행 절차, 출력, 윤리 규칙 섹션을 포함합니다.

**데이터 흐름**: scan → pipeline.md(미처리 공고) → evaluate → applications.md(트래커) + reports/(보고서) → pdf/career-desc → output/(PDF)

**실행 코드 (JS)**:
- `scan-portal.mjs` — Playwright + stealth로 채용 사이트 스캔. 리멤버 등 anti-bot 사이트 접근 가능.
- `generate-pdf.mjs` — HTML → A4 PDF 변환. 출력 경로를 `output/`, `/tmp`으로 제한.
- `dashboard/parser.js` — applications.md 파서. 브라우저와 Node.js에서 공유.
- `dashboard/dashboard.js` — Chart.js 시각화. parser.js를 `<script>`로 로드.

## 사용법

```
/career-ops-kr setup              # 원클릭 온보딩 (이력서 PDF → 자동 설정)
/career-ops-kr scan               # 채용 공고 탐색
/career-ops-kr [URL 붙여넣기]     # 공고 평가
/career-ops-kr pdf [URL]          # 맞춤 이력서 PDF
/career-ops-kr 경력기술서 [URL]    # 맞춤 경력기술서 PDF
/career-ops-kr 자소서 [URL]       # 자기소개서 초안
/career-ops-kr 현황               # 지원 현황 보기
/career-ops-kr 조사 [기업명]      # 기업 심층 조사
/career-ops-kr 연락 [기업명]      # 링크드인 메시지 생성
```

## 사용자가 작성하는 파일 (gitignored)

| 파일 | 설명 |
|------|------|
| `cv.md` | 이력서 원본 |
| `career-description.md` | 경력기술서 원본 |
| `config/profile.yml` | 프로필 설정 (profile.example.yml에서 복사) |
| `portals.yml` | 포털 설정 (portals.example.yml에서 복사) |
| `data/` | 지원 현황, 파이프라인, 스캔 이력 (자동 생성) |
| `reports/` | 평가 보고서 (자동 생성) |
| `output/` | 생성된 PDF (자동 생성) |

## PM 평가 시스템

- **5개 아키타입**: Growth, Platform, B2B, Consumer, AI/Data PM
- **10개 차원**: 역할 매칭(20%), 도메인(15%), 직급(15%), 보상(10%), 성장(10%), 문화(10%), 제품 복잡도(5%), 팀 구조(5%), 기술 스택(5%), 리모트(5%)
- **스케일**: 1.0-5.0 (4.0+ 적극 지원, 3.0-3.9 선택적, <3.0 비추천)
- 상세 기준은 `modes/_shared.md` 참조

## 스캔 전략

자동 폴백 시스템: Tier 1 (Playwright + stealth, `scan-portal.mjs`) → 실패 시 Tier 2 (WebSearch) → Tier 3 (수동 URL 투입). `portals.yml`의 `scan_strategy` 필드로 기업별 전략 지정.

## git 설정

- Author: `jinjin1 <jinjin1@users.noreply.github.com>`
- 실명/개인 이메일을 커밋에 포함하지 않습니다
