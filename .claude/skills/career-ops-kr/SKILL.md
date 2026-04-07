# /career-ops-kr

한국 PM 구직 파이프라인. AI가 채용 공고를 자동 스캔하고 평가하여
맞춤 이력서/경력기술서를 생성합니다.

## 라우팅

사용자 입력에 따라 적절한 모드를 실행합니다.

### URL 감지
- 채용 공고 URL이 입력되면 → `modes/evaluate.md` 실행
- `wanted.co.kr`, `toss.im/career`, `careers.kakao.com` 등 채용 사이트 URL 패턴 감지

### 명시적 명령

| 명령 | 모드 파일 | 설명 |
|------|-----------|------|
| `setup` / `설정` / `온보딩` | `modes/setup.md` | 원클릭 온보딩 (이력서 투입 → 자동 설정) |
| `scan` | `modes/scan.md` | 한국 기업 채용 사이트 스캔 |
| `evaluate` / `평가` | `modes/evaluate.md` | 단일 공고 평가 |
| `pdf` / `이력서` | `modes/pdf.md` | 맞춤 이력서 PDF 생성 |
| `career-desc` / `경력기술서` | `modes/career-desc.md` | 맞춤 경력기술서 PDF 생성 |
| `cover-letter` / `자소서` | `modes/cover-letter.md` | 자기소개서 초안 생성 |
| `pipeline` / `파이프라인` | `modes/pipeline.md` | 미처리 공고 관리 |
| `tracker` / `현황` | `modes/tracker.md` | 지원 현황 추적 |
| `contact` / `연락` | `modes/contact.md` | 링크드인 아웃리치 메시지 |
| `deep` / `조사` | `modes/deep.md` | 기업 심층 조사 |

### JD 텍스트 감지
- 채용 공고 텍스트가 붙여넣어지면 → `modes/evaluate.md` 실행
- 감지 키워드: "자격요건", "우대사항", "주요업무", "채용", "모집", "지원자격"

## 공유 컨텍스트

모든 모드는 `modes/_shared.md`를 먼저 로드합니다.
이 파일에는 PM 아키타입, 평가 기준, 윤리 가이드라인이 포함되어 있습니다.

## 온보딩 (첫 사용 시)

첫 사용 시 `/career-ops-kr setup`을 실행하여 대화형 온보딩을 진행합니다.
상세 흐름은 `modes/setup.md`를 참조합니다.
