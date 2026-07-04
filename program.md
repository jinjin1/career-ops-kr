# career-ops-kr: Autoresearch 자동 개선 루프

> [karpathy/autoresearch](https://github.com/karpathy/autoresearch)에서 영감을 받은 자율 개선 에이전트.
> 코드를 수정하고, 결과를 측정하고, 개선되면 유지 / 악화되면 폐기하는 루프를 반복한다.

---

## 개요

독립적인 개선 트랙을 **교대로** 실행한다:

| 트랙 | 대상 | 메트릭 | 측정 방식 | 수정 파일 |
|------|------|--------|----------|----------|
| **Track B** | 프롬프트 품질 | 평가 출력 품질 점수 (0-100) | LLM-as-judge | `modes/evaluate.md` |
| **Track C** | 스캔 커버리지 | 고유 PM 공고 발견 수 | WebSearch 카운트 | `templates/portals.example.yml`, `modes/scan.md` |
| **Track D** | 온보딩 품질 | 온보딩 품질 점수 (0-100) | LLM-as-judge | `modes/setup.md` |
| **Track E** | 모드 구조 일관성 | 필수 섹션 충족률 (%) | 결정론적 | `modes/*.md` |
| **Track F** | 파서 견고성 | 통과 테스트 assert 수 | 결정론적 (`npm test`) | `dashboard/parser.js`, `dashboard/dashboard.test.mjs` |
| **Track G** | URL 검증 정확도 | 라벨 fixture 정분류율 (%) | 결정론적 (오프라인) | `validate-urls.mjs` |

기본 실행 순서: B → C → B → C → ... (한 번에 **한 트랙**, **한 가지 변경**만.)
결정론적 트랙(E/F/G)은 채점 노이즈가 0이므로, LLM-as-judge 트랙(B/D)을 시작하기 전에 먼저 실행하여 루프 자체를 검증하는 용도로 권장한다.

---

## 공통 규칙

### 수정 불가 파일 (Read-Only)
- `cv.md`, `career-description.md` — 사용자 데이터. 절대 수정 금지.
- `CLAUDE.md` — 프로젝트 설정.
- `config/` — 사용자 설정.
- `data/` — 런타임 데이터.

### 단순성 기준 (Simplicity Criterion)
> "1점 개선을 위해 20줄의 hacky 프롬프트를 추가한다면? 그만한 가치가 없다."

모든 변경은 아래 기준을 충족해야 한다:
- **한 가지 변경**: 한 번에 하나의 가설만 테스트.
- **최소 diff**: 변경 라인 수 최소화. 불필요한 장식, 주석, 재구조화 금지.
- **가역성**: git reset으로 즉시 원복 가능.
- **점수 향상 > 2점**: 2점 이하의 미미한 개선은 노이즈로 간주하고 폐기.

### 로깅

모든 실험 결과는 `autoresearch/results.tsv`에 기록한다:

```
commit	track	score	block_scores	delta	diff_lines	kept	description
a1b2c3d	B	78	comp:18,spec:15,act:16,score:14,kr:15	+5	4	yes	Block B 매핑 테이블에 '구체적 프로젝트명 필수' 지시 추가
d4e5f6g	C	23	-	+3	1	yes	jumpit.co.kr PM 검색 쿼리 추가
```

컬럼 정의:
- `commit`: git short hash
- `track`: B~G 중 하나
- `score`: 해당 트랙의 메트릭 (B/D: 0-100, C: 고유 공고 수, E/G: %, F: assert 수)
- `block_scores`: Track B/D만 해당 — 세부 점수 (comp/spec/act/score/kr)
- `delta`: 이전 대비 변화량
- `diff_lines`: 변경된 라인 수 (`git diff HEAD~1 --shortstat`의 insertions+deletions)
- `kept`: yes / no
- `description`: 변경 내용 한 줄 요약 (한국어)

### 리워드 해킹 감시

`diff_lines`는 단순성 기준의 집행 장치다. kept된 변경 중 **점수 상승 대비 diff가 비대한 변경**(예: +3점에 30줄 이상)은 루브릭 키워드를 프롬프트에 그대로 박아넣는 식의 게이밍일 가능성이 높다. 최종 리포트에서 `delta / diff_lines` 비율이 하위인 kept 변경을 별도로 나열하고, 사용자가 리뷰하여 필요 시 수동 revert한다.

---

## Track B: 프롬프트 품질 (evaluate.md 개선)

### 목표

`modes/evaluate.md`의 지시를 개선하여, 동일한 입력(JD + CV)에 대해 더 높은 품질의 평가 보고서를 생성한다.

### Setup

#### 1. 테스트 Fixture — 가상 JD (3개, 그중 1개는 held-out)

단일 fixture로 최적화하면 그 JD 하나에 과적합된 프롬프트가 나온다. 아키타입이 다른 가상 JD **3개**를 생성한다:

| 파일 | 아키타입 | 용도 |
|------|----------|------|
| `autoresearch/fixtures/sample-jd.md` | Consumer PM (콘텐츠 플랫폼) | 개발용 — 가설 수립 시 열람 가능 |
| `autoresearch/fixtures/sample-jd-b2b.md` | B2B PM (SaaS) | 개발용 — 가설 수립 시 열람 가능 |
| `autoresearch/fixtures/sample-jd-holdout.md` | AI/Data PM | **held-out** — 채점에만 사용. 가설 수립 시 열람 금지 |

점수는 **3개 JD 각각에 대해 평가 보고서를 생성하고 채점한 평균**이다. held-out fixture의 점수만 하락하고 개발용 점수만 오르는 변경은 과적합 신호이므로 폐기한다.

첫 번째 fixture 예시 (`sample-jd.md`):

```markdown
# 가상기업(주) — Product Manager (콘텐츠 플랫폼)

## 조직 설명
가상기업은 MAU 200만의 콘텐츠 구독 플랫폼을 운영하며...

## 주요 업무
- 제품의 핵심 문제를 정의하고 실행 방법을 수립
- 데이터와 사용자 피드백 기반 제품 개선
- 성과 지표 설정 및 실험 주도
- 다양한 이해관계자와 소통 및 협력

## 자격 요건 (필수)
- PM 경력 5년 이상
- 실험 설계 및 데이터 분석 역량
- 웹/모바일 앱 개발과 디자인에 대한 이해
- 전략적 사고 및 빠른 실행력

## 우대 사항
- MAU 100만+ B2C 서비스 경험
- 추천 시스템 또는 ML 프로젝트 경험
- 레거시 시스템 개선 경험

## 근무 조건
- 서울 강남구
- 하이브리드 (주 3일 출근)
- 경력에 따른 협의
```

> **주의**: 이것은 가상의 기업과 JD이다. 실제 기업 데이터를 사용하지 않는다.

#### 2. 테스트 Fixture — 가상 CV

`examples/cv-example.md`의 홍길동 데이터를 그대로 사용한다. (이미 가상 인물.)
경로: `examples/cv-example.md`

#### 3. 품질 루브릭 (0-100점)

| 차원 | 배점 | 평가 기준 |
|------|------|----------|
| **Completeness** (완성도) | 0-20 | 6개 블록(A-F) 모두 존재하고 각 블록에 실질적 내용이 있는가? 빈 테이블, placeholder 텍스트 감점. |
| **Specificity** (구체성) | 0-20 | Block B에서 cv.md의 **구체적 프로젝트명/수치**를 인용하여 JD 요구사항에 매핑하는가? "관련 경험 있음" 같은 generic 매핑은 감점. |
| **Actionability** (실행가능성) | 0-20 | Block E에서 이력서/경력기술서 수정 항목이 **구체적이고 우선순위화**되어 있는가? "더 강조하세요" 같은 모호한 조언은 감점. |
| **Scoring Consistency** (점수 일관성) | 0-20 | 1.0-5.0 종합 점수가 Block B 매칭률, Block C 갭 분석과 **논리적으로 일관**되는가? 매칭률 40%인데 4.5점이면 감점. |
| **Korean Quality** (한국어 품질) | 0-20 | 자연스러운 한국어, 영어 잔재 없음, 적절한 PM 용어 사용. "당신은~", "~해 드리겠습니다" 같은 번역투 감점. |

#### 4. 노이즈 측정 (루프 시작 전 필수)

LLM-as-judge는 같은 입력에도 점수가 흔들린다. 노이즈를 모르면 keep 임계값이 무의미하다.

```
1. 현재 evaluate.md 그대로, 동일 fixture로 평가+채점을 3회 반복
2. 3회 점수의 표준편차 σ 계산
3. keep 임계값 = max(2, 2σ) — 이후 모든 판정에 이 값을 사용
4. baseline = 3회 평균, σ와 함께 results.tsv 첫 행에 기록 (예: description에 "baseline, σ=3.1")
```

σ가 5를 넘으면 개선 실험보다 **채점 안정화가 먼저**다 (루브릭 기준을 더 기계적으로 명확화). 이는 Track B의 전제 조건이며, 노이즈가 큰 상태로 루프를 돌리면 노이즈를 줍는 것에 불과하다.

### 실험 루프

```
반복:
  1. baseline_score = 마지막으로 kept된 점수 (첫 실행이면 노이즈 측정 단계의 평균)

  2. modes/evaluate.md 읽기

  3. 개선 가설 수립 — 한 가지만:
     예시:
     - "Block B 매핑 테이블에 '프로젝트명과 정량 지표를 반드시 인용' 지시 추가"
     - "종합 점수 산출 섹션에 매칭률과 점수의 일관성 검증 단계 추가"
     - "Block E에 '수정 전/후 예시 문장'을 포함하도록 지시"
     - "번역투 한국어 방지를 위한 문체 가이드라인 추가"

  4. evaluate.md 수정 (최소 diff)

  5. git commit -m "autoresearch(B): {변경 설명}"

  6. 평가 실행 (JD fixture 3개 각각에 대해):
     - fixtures/sample-jd*.md를 JD로 사용 (held-out 포함)
     - examples/cv-example.md를 CV로 사용
     - 수정된 evaluate.md의 지시에 따라 평가 보고서 생성
     - 출력을 autoresearch/output/latest-eval-{fixture}.md에 저장

  7. LLM-as-judge 채점:
     - 위 루브릭(5개 차원)에 따라 3개 출력물을 각각 채점
     - new_score = 3개 점수의 평균
     - 각 차원 점수 + 총점 + 감점 사유를 구조화하여 기록

  8. 판정 (threshold = 노이즈 측정 단계의 max(2, 2σ)):
     IF new_score - baseline_score > threshold
        AND held-out fixture 점수가 하락하지 않음:
       KEEP — 로그에 kept=yes 기록
       baseline_score = new_score
     ELSE:
       DISCARD — git reset --hard HEAD~1
       로그에 kept=no 기록

  9. results.tsv에 기록

  10. 다음 반복 (또는 Track C로 전환)
```

### 수정 가능 범위

| 허용 | 금지 |
|------|------|
| `modes/evaluate.md` 내 지시문 수정 | 블록 구조(A-F) 자체를 삭제/병합 |
| 새로운 지시 항목 추가 | 출력 형식의 마크다운 구조 변경 |
| 예시/가이드라인 추가 | 종합 점수 가중치 변경 (이건 별도 트랙) |
| 문체/어투 개선 | `_shared.md` 수정 |
| 채점 기준 명확화 | fixture 파일 수정 (테스트 일관성) |

---

## Track C: 스캔 커버리지

### 목표

`templates/portals.example.yml`의 search_queries와 `modes/scan.md`를 개선하여, WebSearch로 발견할 수 있는 고유 PM 공고 수를 늘린다.

### Setup

#### 1. Baseline 측정

현재 `portals.example.yml`의 `search_queries` 섹션에 있는 모든 쿼리를 WebSearch로 실행한다.

```
각 쿼리에 대해:
  1. WebSearch 실행
  2. 결과 중 title_filter positive 키워드에 매칭되는 것만 카운트
  3. URL로 중복 제거
  4. 고유 PM 공고 수 = baseline
```

baseline을 `autoresearch/results.tsv` 첫 행에 기록한다.

#### 2. 품질 필터

결과가 PM 공고로 인정되려면:
- `title_filter.positive` 키워드 중 하나 이상 포함
- `title_filter.negative` 키워드 미포함
- 실제 채용 공고 페이지 URL (블로그, 뉴스 기사 제외)

### 실험 루프

```
반복:
  1. baseline_count = 마지막으로 kept된 고유 공고 수

  2. portals.example.yml의 search_queries 섹션 읽기

  3. 개선 가설 수립 — 한 가지만:
     예시:
     - "jumpit.co.kr PM 검색 쿼리 추가"
     - "인크루트(incruit.com) 프로덕트매니저 쿼리 추가"
     - "기존 '프로덕트매니저 채용 2026' → 연도 없는 범용 쿼리로 변경"
     - "특정 도메인(헬스케어, 에드테크) PM 검색 쿼리 추가"
     - "영문 쿼리 추가: 'product manager Seoul hiring'"

  4. portals.example.yml 수정 (쿼리 1개 추가 또는 수정)

  5. git commit -m "autoresearch(C): {변경 설명}"

  6. 새 쿼리만 WebSearch 실행:
     - 결과에서 title_filter 적용
     - 기존 결과(이전까지 발견된 URL 풀)와 대조하여 신규만 카운트

  7. 판정:
     IF new_unique_count > 0:
       KEEP — 새 URL을 발견 URL 풀에 추가
       로그에 kept=yes 기록
     ELSE:
       DISCARD — git reset --hard HEAD~1
       로그에 kept=no 기록

  8. results.tsv에 기록

  9. 다음 반복 (또는 Track B로 전환)
```

### 수정 가능 범위

| 허용 | 금지 |
|------|------|
| `search_queries` 섹션에 쿼리 추가/수정 | `portals` 섹션의 기업 목록 삭제 |
| `portals` 섹션에 새 기업 추가 | `title_filter` 키워드 변경 (일관성) |
| 기업별 `websearch_queries` 추가/수정 | `scan_strategy` 변경 |
| `modes/scan.md`에 새 검색 전략 추가 | 기존 스캔 로직 삭제 |

---

## 디렉토리 구조

```
autoresearch/
├── fixtures/
│   ├── sample-jd.md              # 가상 JD — Consumer PM (Track B, 개발용)
│   ├── sample-jd-b2b.md          # 가상 JD — B2B PM (Track B, 개발용)
│   ├── sample-jd-holdout.md      # 가상 JD — AI/Data PM (Track B, held-out)
│   └── url-cases.json            # URL 판정 라벨 케이스 (Track G)
├── output/
│   └── latest-eval-{fixture}.md  # 최근 평가 출력 (Track B, fixture별)
├── results.tsv                   # 전체 실험 로그
└── discovered-urls.txt           # 발견된 공고 URL 풀 (Track C, 중복 제거용)
```

---

## 실행 방법

```bash
# 1. 디렉토리 초기화
mkdir -p autoresearch/fixtures autoresearch/output

# 2. 가상 JD fixture 생성 (위의 sample-jd.md 내용)
# 3. Track B baseline 측정
# 4. Track C baseline 측정
# 5. 루프 시작
```

---

## Track D: Setup 온보딩 품질 (setup.md 개선)

### 목표

`modes/setup.md`의 온보딩 지시를 개선하여, 가상 이력서(examples/cv-example.md)를 투입했을 때 더 높은 품질의 온보딩 경험을 제공한다.

### Setup

#### 1. 테스트 Fixture — 가상 CV

`examples/cv-example.md`의 홍길동 이력서를 그대로 사용한다. (이미 가상 인물.)

#### 2. 품질 루브릭 (0-100점)

| 차원 | 배점 | 평가 기준 |
|------|------|----------|
| **Parsing accuracy** (파싱 정확도) | 0-20 | cv-example.md에서 정보를 정확히 추출하는가? |
| **Skeleton completeness** (스켈레톤 완성도) | 0-20 | career-description.md 스캐폴드가 유용하고 채울 수 있는가? |
| **Conversation clarity** (대화 명확성) | 0-20 | 비개발자에게 질문이 명확한가? |
| **Error handling** (에러 처리) | 0-20 | 실패 케이스가 잘 명시되어 있는가? |
| **5-minute experience** (5분 경험) | 0-20 | 5분 내에 플로우를 완료할 수 있는가? |

### 실험 루프

```
반복:
  1. baseline_score = 마지막으로 kept된 점수 (첫 실행이면 현재 setup.md로 측정)

  2. modes/setup.md 읽기

  3. 개선 가설 수립 — 한 가지만:
     예시:
     - "PDF 파싱 실패 시 대체 경로를 더 명확하게 안내"
     - "경력기술서 스켈레톤에 STAR 형식 가이드 추가"
     - "비개발자용 용어 설명 추가"

  4. setup.md 수정 (최소 diff)

  5. git commit -m "autoresearch(D): {변경 설명}"

  6. 시뮬레이션 실행:
     - examples/cv-example.md를 입력으로 사용
     - 수정된 setup.md의 지시에 따라 온보딩 플로우 시뮬레이션
     - 루브릭에 따라 채점

  7. 판정:
     IF new_score - baseline_score > 2:
       KEEP — 로그에 kept=yes 기록
       baseline_score = new_score
     ELSE:
       DISCARD — git reset --hard HEAD~1
       로그에 kept=no 기록

  8. results.tsv에 기록

  9. 다음 반복 (또는 다른 트랙으로 전환)
```

### 수정 가능 범위

| 허용 | 금지 |
|------|------|
| `modes/setup.md` 내 지시문 수정 | 온보딩 단계(Step 1-5) 자체를 삭제/병합 |
| 새로운 지시 항목 추가 | 출력 파일 목록 변경 |
| 에러 처리 경로 추가/개선 | `_shared.md` 수정 |
| 대화 문구 개선 | fixture 파일 수정 (테스트 일관성) |

---

## Track E: 모드 구조 일관성

### 목표

모든 `modes/*.md` 파일이 필수 섹션을 갖추도록 구조적 일관성을 높인다.

### 필수 섹션

모든 모드 파일은 아래 섹션을 포함해야 한다:
- 제목 (# 타이틀)
- 설명 (첫 문단)
- 사전 조건/사전 준비
- 실행 절차
- 출력
- 윤리 규칙

### 메트릭

```
Score = (필수 섹션을 모두 갖춘 모드 수 / 전체 모드 수) × 100
```

각 `modes/*.md` 파일을 읽고 필수 섹션 헤더 존재 여부를 확인한다.
(`_shared.md`는 공유 설정 파일이므로 제외.)

### 실험 루프

```
반복:
  1. baseline_score = 마지막으로 kept된 점수

  2. 모든 modes/*.md 파일 읽기

  3. 필수 섹션이 누락된 모드 파일 식별

  4. 하나의 모드 파일에 누락된 섹션 추가 (최소 diff)

  5. git commit -m "autoresearch(E): {변경 설명}"

  6. 재측정:
     - 모든 modes/*.md 파일의 필수 섹션 존재 여부 재확인
     - 새 점수 계산

  7. 판정:
     IF new_score - baseline_score > 2:
       KEEP — 로그에 kept=yes 기록
     ELSE:
       DISCARD — git reset --hard HEAD~1
       로그에 kept=no 기록

  8. results.tsv에 기록
```

### 수정 가능 범위

| 허용 | 금지 |
|------|------|
| 누락된 필수 섹션 추가 | 기존 섹션 내용 수정 |
| 섹션 헤더 및 최소 내용 추가 | 기존 섹션 삭제/병합 |
| | `_shared.md` 수정 |

---

## Track F: 파서 견고성 (parser.js 개선)

### 목표

`dashboard/parser.js`가 손상되거나 변형된 applications.md 입력을 더 견고하게 처리하도록 개선한다.
채점이 `npm test`로 완전히 결정론적이므로 노이즈가 0이고, LLM-judge 비용이 들지 않는다.

### 메트릭

```
Score = npm test 통과 assert 수 (전체 통과가 전제 — 하나라도 실패하면 즉시 discard)
```

현재 baseline: `dashboard/dashboard.test.mjs`의 통과 assert 수.

### 실험 루프

```
반복:
  1. baseline = 현재 통과 assert 수 (npm test 실행하여 확인)

  2. 견고성 가설 수립 — 한 가지만:
     예시:
     - "점수 컬럼에 '4.3점'처럼 단위가 붙어도 파싱"
     - "URL 컬럼이 마크다운 링크 형식([텍스트](url))이어도 추출"
     - "셀 안에 이스케이프된 파이프(\|)가 있어도 컬럼 분리 유지"
     - "빈 비고 컬럼(trailing |)이 생략된 행도 파싱"

  3. RED 확인: 가설에 해당하는 테스트를 dashboard.test.mjs에 추가하고,
     parser.js 수정 없이 npm test 실행 → 새 assert가 실패함을 확인.
     (실패하지 않으면 이미 처리되는 케이스 — 테스트만 커밋하고 다음 가설로)

  4. GREEN: parser.js를 최소 diff로 수정하여 새 assert 통과

  5. npm test 전체 실행 — 기존 assert 포함 전부 통과 확인

  6. git commit -m "autoresearch(F): {변경 설명}"

  7. 판정:
     IF 전체 통과 AND 통과 assert 수 > baseline:
       KEEP
     ELSE:
       DISCARD — git reset --hard HEAD~1

  8. results.tsv에 기록
```

> **RED→GREEN 규칙이 곧 리워드 해킹 방지다.** assert 수가 메트릭이므로 자명하게 통과하는
> 테스트를 추가하면 점수가 공짜로 오른다. 3단계에서 "수정 전 실패"를 증명하지 못한
> 테스트는 메트릭에 포함하지 않는다.

### 수정 가능 범위

| 허용 | 금지 |
|------|------|
| `parser.js` 파싱 로직 개선 | 기존 테스트 삭제/약화 |
| `dashboard.test.mjs`에 테스트 추가 (RED 증명 필수) | `STATUS_MAP` 키/값 의미 변경 |
| | 반환 객체 필드 구조 변경 (dashboard.js와의 계약) |
| | `dashboard.js` 수정 (별도 트랙) |

---

## Track G: URL 검증 정확도 (validate-urls.mjs 개선)

### 목표

`validate-urls.mjs`의 **순수 판정 로직**(`isHomepageRedirect`, `DEAD_PAGE_PATTERNS` 매칭)의
분류 정확도를 높인다. 실제 네트워크 호출 없이 라벨링된 fixture만으로 채점하므로
오프라인·결정론적이다.

### Setup — 라벨 fixture

`autoresearch/fixtures/url-cases.json`에 판정 케이스를 생성한다:

```json
[
  {
    "id": "homepage-redirect-1",
    "originalUrl": "https://careers.example.com/jobs/12345",
    "finalUrl": "https://careers.example.com/",
    "pageText": null,
    "label": "dead",
    "reason": "상세 공고가 홈으로 리다이렉트 = 마감"
  },
  {
    "id": "dead-text-1",
    "originalUrl": "https://example.com/jobs/999",
    "finalUrl": "https://example.com/jobs/999",
    "pageText": "마감된 공고입니다. 다른 채용 공고를 확인해 보세요.",
    "label": "dead",
    "reason": "마감 안내 문구 포함"
  },
  {
    "id": "live-1",
    "originalUrl": "https://example.com/jobs/100",
    "finalUrl": "https://example.com/jobs/100",
    "pageText": "Product Manager를 모집합니다. 지원하기",
    "label": "live",
    "reason": "정상 공고 페이지"
  }
]
```

- 가상 URL/문구만 사용한다 (실제 기업 데이터 금지, Track B fixture와 동일 원칙).
- live/dead 라벨을 균형 있게 20개 이상 구성한다 (전부 dead면 "모두 dead 판정"이 만점이 되는 퇴화 발생).

### 메트릭

```
Score = 정분류 케이스 수 / 전체 케이스 수 × 100
```

각 케이스에 대해 `isHomepageRedirect(originalUrl, finalUrl)` 결과와 `DEAD_PAGE_PATTERNS`의
`pageText` 매칭 결과를 조합해 live/dead를 판정하고, 라벨과 비교한다.
(Node로 함수를 import하여 실행 — 네트워크 불필요.)

### 실험 루프

```
반복:
  1. baseline = 마지막으로 kept된 정분류율

  2. 개선 가설 수립 — 한 가지만:
     예시:
     - "DEAD_PAGE_PATTERNS에 '채용이 종료되었습니다' 패턴 추가"
     - "isHomepageRedirect가 쿼리스트링만 다른 경우를 리다이렉트로 오판하지 않도록 수정"
     - "언어별 마감 문구(영문 'no longer accepting') 패턴 추가"

  3. validate-urls.mjs 수정 (최소 diff)

  4. git commit -m "autoresearch(G): {변경 설명}"

  5. fixture 전체에 대해 재채점

  6. 판정:
     IF new_accuracy > baseline:
       KEEP
     ELSE:
       DISCARD — git reset --hard HEAD~1

  7. results.tsv에 기록
```

### 수정 가능 범위

| 허용 | 금지 |
|------|------|
| `DEAD_PAGE_PATTERNS` 추가/수정 | 로직 수정과 같은 커밋에서 fixture 수정 |
| `isHomepageRedirect` 로직 개선 | fixture 라벨 변경으로 점수 올리기 |
| fixture 케이스 추가 (별도 커밋 + baseline 재측정) | 네트워크 호출 추가 (채점은 오프라인 유지) |
| | HTTP/브라우저 검증 파이프라인 구조 변경 |

> fixture를 확장하는 커밋과 로직을 고치는 커밋을 분리하는 것이 이 트랙의 게이밍 방지 장치다.
> 같은 커밋에서 둘을 함께 바꾸면 "채점 기준을 정답에 맞추는" 조작이 가능해진다.

---

에이전트는 아래 순서로 실행한다:

```
1. autoresearch/ 디렉토리 확인 및 초기화
2. 결정론적 트랙(F, G) baseline 측정 및 각 1회 실행 — 루프 자체 검증
3. Track B 노이즈 측정 (3회) + baseline 확정, Track C baseline 측정
4. Track B 1회 실행
5. Track C 1회 실행
6. 4-5 반복 (사이사이 F/G를 끼워 넣어도 됨)
7. 10회 반복 후 results.tsv 요약 출력
```

### 종료 조건

- **Track B**: 3회 연속 discard → 해당 트랙 일시 중단, Track C만 진행
- **Track C**: 5회 연속 discard → 해당 트랙 일시 중단
- **Track F/G**: 3회 연속 discard → 해당 트랙 중단 (결정론적이므로 재시도 의미 없음)
- **모든 활성 트랙 중단**: 전체 루프 종료, 최종 리포트 출력

### 최종 리포트

루프 종료 시 요약을 출력한다:

```
=== Autoresearch 완료 ===
총 실험: 20회
├── Track B: 10회 (kept: 6, discarded: 4)
│   시작 점수: 62 → 최종 점수: 81 (+19)
│   가장 큰 개선: "Block B에 프로젝트명 필수 인용 지시" (+8)
├── Track C: 10회 (kept: 7, discarded: 3)
│   시작 공고 수: 15 → 최종 공고 수: 34 (+19)
│   가장 효과적 쿼리: "site:jumpit.co.kr 프로덕트매니저" (+5)
└── 리뷰 필요 (delta/diff_lines 하위): a1b2c3d "+3점, 32줄" — 게이밍 여부 확인
```
