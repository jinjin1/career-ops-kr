# career-ops-kr: Autoresearch 자동 개선 루프

> [karpathy/autoresearch](https://github.com/karpathy/autoresearch)에서 영감을 받은 자율 개선 에이전트.
> 코드를 수정하고, 결과를 측정하고, 개선되면 유지 / 악화되면 폐기하는 루프를 반복한다.

---

## 개요

두 개의 독립적인 개선 트랙을 **교대로** 실행한다:

| 트랙 | 대상 | 메트릭 | 수정 파일 |
|------|------|--------|----------|
| **Track B** | 프롬프트 품질 | 평가 출력 품질 점수 (0-100) | `modes/evaluate.md` |
| **Track C** | 스캔 커버리지 | 고유 PM 공고 발견 수 | `templates/portals.example.yml`, `modes/scan.md` |

실행 순서: B → C → B → C → ... (한 번에 **한 트랙**, **한 가지 변경**만.)

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
commit	track	score	block_scores	delta	kept	description
a1b2c3d	B	78	comp:18,spec:15,act:16,score:14,kr:15	+5	yes	Block B 매핑 테이블에 '구체적 프로젝트명 필수' 지시 추가
d4e5f6g	C	23	-	+3	yes	jumpit.co.kr PM 검색 쿼리 추가
```

컬럼 정의:
- `commit`: git short hash
- `track`: B 또는 C
- `score`: 해당 트랙의 메트릭 (B: 0-100, C: 고유 공고 수)
- `block_scores`: Track B만 해당 — 세부 점수 (comp/spec/act/score/kr)
- `delta`: 이전 대비 변화량
- `kept`: yes / no
- `description`: 변경 내용 한 줄 요약 (한국어)

---

## Track B: 프롬프트 품질 (evaluate.md 개선)

### 목표

`modes/evaluate.md`의 지시를 개선하여, 동일한 입력(JD + CV)에 대해 더 높은 품질의 평가 보고서를 생성한다.

### Setup

#### 1. 테스트 Fixture — 가상 JD

`autoresearch/fixtures/sample-jd.md`에 가상의 PM 채용 공고를 생성한다.

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

### 실험 루프

```
반복:
  1. baseline_score = 마지막으로 kept된 점수 (첫 실행이면 현재 evaluate.md로 측정)

  2. modes/evaluate.md 읽기

  3. 개선 가설 수립 — 한 가지만:
     예시:
     - "Block B 매핑 테이블에 '프로젝트명과 정량 지표를 반드시 인용' 지시 추가"
     - "종합 점수 산출 섹션에 매칭률과 점수의 일관성 검증 단계 추가"
     - "Block E에 '수정 전/후 예시 문장'을 포함하도록 지시"
     - "번역투 한국어 방지를 위한 문체 가이드라인 추가"

  4. evaluate.md 수정 (최소 diff)

  5. git commit -m "autoresearch(B): {변경 설명}"

  6. 평가 실행:
     - fixtures/sample-jd.md를 JD로 사용
     - examples/cv-example.md를 CV로 사용
     - 수정된 evaluate.md의 지시에 따라 평가 보고서 생성
     - 출력을 autoresearch/output/latest-eval.md에 저장

  7. LLM-as-judge 채점:
     - 위 루브릭(5개 차원)에 따라 출력물 채점
     - 각 차원 점수 + 총점 + 감점 사유를 구조화하여 기록

  8. 판정:
     IF new_score - baseline_score > 2:
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
│   └── sample-jd.md          # 가상 JD (Track B용)
├── output/
│   └── latest-eval.md        # 최근 평가 출력 (Track B)
├── results.tsv               # 전체 실험 로그
└── discovered-urls.txt       # 발견된 공고 URL 풀 (Track C, 중복 제거용)
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

에이전트는 아래 순서로 실행한다:

```
1. autoresearch/ 디렉토리 확인 및 초기화
2. baseline 측정 (Track B + Track C)
3. Track B 1회 실행
4. Track C 1회 실행
5. 3-4 반복
6. 10회 반복 후 results.tsv 요약 출력
```

### 종료 조건

- **Track B**: 3회 연속 discard → 해당 트랙 일시 중단, Track C만 진행
- **Track C**: 5회 연속 discard → 해당 트랙 일시 중단
- **양쪽 모두 중단**: 전체 루프 종료, 최종 리포트 출력

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
```
