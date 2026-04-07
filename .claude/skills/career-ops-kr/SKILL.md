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

1. `cv.md` 존재 확인 → 없으면 생성 가이드
2. `career-description.md` 존재 확인 → 없으면 생성 가이드
3. `config/profile.yml` 존재 확인 → 없으면 `config/profile.example.yml`에서 복사
4. `portals.yml` 존재 확인 → 없으면 `templates/portals.example.yml`에서 복사
5. 사용자에게 핵심 역량과 타겟 기업 질문
