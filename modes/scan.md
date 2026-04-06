# 포털 스캐너 (scan)

이 모드는 한국 기업 채용 사이트와 채용 플랫폼을 자동으로 스캔하여
PM/PO/서비스기획 공고를 발견하고 `data/pipeline.md`에 추가합니다.

## 사전 조건

- `portals.yml`이 프로젝트 루트에 존재해야 합니다.
- 없으면 `templates/portals.example.yml`을 복사하여 생성하세요.

## 스캐닝 전략 (자동 폴백 포함)

각 기업에 대해 아래 순서로 스캔을 시도합니다.
`portals.yml`에서 `scan_strategy` 필드를 확인하여 시작 Tier를 결정합니다.

```
각 기업에 대해:
┌─ scan_strategy 확인
│
├─ "playwright_first" (기본값):
│   1. Playwright로 careers_url 방문
│   2. 성공 → 공고 추출 → 필터링 → 완료
│   3. 실패 (403/timeout/빈 결과) → 자동으로 WebSearch 폴백
│      └─ websearch_queries가 있으면 그것을 사용
│      └─ 없으면 "site:{도메인} 프로덕트매니저 PM" 자동 생성
│   4. WebSearch도 0건 → scan-history.tsv에 "scan_failed" 기록
│
├─ "websearch_only" (차단된 사이트):
│   1. Playwright 건너뜀 (차단 확인됨)
│   2. portals.yml의 websearch_queries로 직접 WebSearch 실행
│   3. 0건이면 scan-history.tsv에 "scan_failed" 기록
│
└─ "manual_only" (완전 차단):
    1. 스캔하지 않음
    2. 사용자가 앱에서 직접 URL을 투입해야 함
    3. 스캔 보고서에 "수동 확인 필요" 표시
```

### Tier 1: Playwright Direct (기업 자체 채용 사이트)

`scan_strategy`가 `playwright_first`(기본값)인 기업에 대해 실행합니다.

**실행 방법:**
1. `portals.yml`에서 기업 목록을 읽습니다.
2. 각 기업의 `careers_url`을 Playwright로 방문합니다.
3. 페이지의 채용 공고 목록을 DOM에서 읽습니다.
4. `title_filter`의 positive/negative 키워드로 PM 공고만 필터링합니다.

**Playwright 스캔 절차:**
```
각 기업 URL에 대해:
1. page.goto(careers_url, { waitUntil: 'networkidle', timeout: 15000 })
2. HTTP 상태 코드 확인 → 403/429/5xx이면 즉시 WebSearch 폴백
3. 채용 공고 목록 요소를 찾습니다 (사이트별로 selector가 다름)
4. 공고가 0건이면 → WebSearch 폴백 (빈 결과도 실패로 간주)
5. 각 공고에서 제목, URL, 부서 정보를 추출합니다
6. title_filter로 PM 관련 공고만 필터링합니다
7. scan-history.tsv와 대조하여 중복을 제거합니다
8. 새로운 공고를 data/pipeline.md에 추가합니다
```

**사이트별 스캔 참고:**
- 카카오 계열: SPA 기반, 로딩 후 DOM 읽기 필요
- 토스 계열: React 기반, networkidle 대기 필요
- 네이버: 서버사이드 렌더링, 즉시 DOM 읽기 가능
- 당근: about.daangn.com/jobs/ — 정적 페이지
- 오퍼센트: offercent.co.kr — 카테고리 필터 URL 파라미터 활용

**사이트별 접근 상태:**
- 리멤버 (rememberapp.co.kr): browse stealth로 접근 가능 (200). SPA이므로 검색은 fill+click 인터랙션 필요 → `playwright_first`
- 원티드 (wanted.co.kr): CDN 차단 (403). browse stealth도 실패 → `websearch_only`. 사용자 브라우저 쿠키 임포트 시 접근 가능 가능성 있음
- 쿠팡 (coupang.jobs): Cloudflare 차단 → `websearch_only`

**Google 일반 검색의 중요성:**
`site:` 없는 일반 Google 검색("프로덕트매니저 채용 2026" 등)은 원티드/리멤버에서 직접 스캔하지 못하는 공고를 발견하는 핵심 보완 수단입니다. Tier 2이지만 Tier 1과 동등한 중요도로 반드시 실행해야 합니다.

### Tier 2: WebSearch (자동 폴백 + 전용 스캔)

Playwright 실패 시 자동으로 전환되거나, `scan_strategy: websearch_only` 사이트에서 직접 실행됩니다.

**실행 방법:**
1. 기업별 `websearch_queries`가 있으면 그것을 사용
2. 없으면 자동 생성: `site:{도메인} 프로덕트매니저 PM`
3. `portals.yml`의 `search_queries` 섹션도 실행 (범용 검색)
4. 결과에서 채용 공고 URL을 추출
5. title_filter로 PM 공고만 필터링
6. 중복 제거 후 pipeline.md에 추가

**WebSearch 제약사항:**
- 결과가 실시간이 아닐 수 있습니다 (수일~수주 지연 가능).
- 모든 공고를 발견하지 못할 수 있습니다.
- 원티드/리멤버 앱에서 직접 알림을 설정하는 것이 가장 확실합니다.

### Tier 3: 수동 URL 투입 (보조)

사용자가 원티드/리멤버/링크드인 앱에서 직접 발견한 공고 URL을
`data/pipeline.md`에 붙여넣으면 자동 평가 파이프라인에 투입됩니다.

```
사용자: [URL을 붙여넣기]
→ 자동으로 evaluate 모드 실행
→ 보고서 생성 + 점수 산출
→ data/applications.md에 기록
```

## 타이틀 필터링

```yaml
positive_keywords:
  - 프로덕트 매니저
  - 프로덕트매니저
  - Product Manager
  - PM
  - PO
  - 프로덕트 오너
  - Product Owner
  - 서비스기획
  - 서비스 기획
  - 프로덕트 기획
  - 제품 기획

negative_keywords:
  - 인턴
  - 파트타임
  - 계약직
  - 아르바이트
  - 단기
  - Project Manager  # PM과 구분 주의
```

**PM vs Project Manager 구분:**
- "PM"만 있는 경우 JD 본문을 확인하여 Product Manager인지 Project Manager인지 구분합니다.
- 제품 관련 키워드(사용자 경험, 로드맵, 지표, A/B 테스트)가 있으면 Product Manager.
- 일정 관리, 리소스 배분, 프로젝트 일정 중심이면 Project Manager → 필터 아웃.

## 중복 제거

새로 발견된 공고는 아래 3개 파일과 대조하여 중복을 제거합니다:
1. `data/scan-history.tsv` — 이전 스캔에서 발견된 공고
2. `data/applications.md` — 이미 평가/지원한 공고
3. `data/pipeline.md` — 현재 대기 중인 공고

매칭 기준: 기업명 + 직무명 퍼지 매칭 또는 URL 정확 매칭.

## 출력

새로 발견된 공고를 `data/pipeline.md`에 추가합니다:

```markdown
- [ ] [카카오] Product Manager, 카카오톡 — https://careers.kakao.com/jobs/xxx (발견일: 2026-04-07)
- [ ] [토스] PM, 토스페이 결제 — https://toss.im/career/job-detail?job_id=xxx (발견일: 2026-04-07)
```

## 스캔 이력 기록

모든 발견된 공고(필터 통과 여부 무관)를 `data/scan-history.tsv`에 기록합니다:

```
날짜	기업	직무	URL	필터결과	스캔방법
2026-04-07	카카오	Product Manager	https://...	pass	playwright
2026-04-07	쿠팡	Product Manager	https://...	pass	websearch_fallback
2026-04-07	카카오	프로젝트 매니저	https://...	filtered_out	playwright
```

## 스캔 완료 보고

스캔 완료 후 요약을 출력합니다:

```
=== 스캔 완료 ===
스캔한 기업: 12개
├── Playwright 성공: 5개 (토스, 당근, 카카오, 네이버, 오퍼센트)
├── WebSearch 폴백: 2개 (카카오뱅크→폴백, 라인→폴백)
├── WebSearch 전용: 3개 (쿠팡, 원티드, 리멤버)
├── 수동 확인 필요: 1개
└── 스캔 실패: 1개 (사유: ...)

발견한 공고: 45건
PM 필터 통과: 18건
중복 제거 후: 12건 (신규)
pipeline.md에 추가: 12건

⚠️ WebSearch 폴백 사이트:
  - 쿠팡: Cloudflare 차단 → WebSearch로 3건 발견
  - 원티드: CDN 차단 → WebSearch로 8건 발견 (비실시간)
  - 리멤버: 동적 로딩 → WebSearch로 2건 발견

💡 팁: 원티드/리멤버 앱에서 PM 키워드 알림을 설정하면 누락을 줄일 수 있습니다.
```
