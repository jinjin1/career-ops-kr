# career-ops-kr

한국 PM/PO 구직자를 위한 AI 구직 파이프라인.
Claude Code 스킬로 동작하며, 채용 공고 스캔, 평가, 맞춤 이력서/경력기술서 생성을 자동화합니다.

## 핵심 원칙

1. **절대 지원서를 자동 제출하지 않습니다.** 양식을 채울 수 있지만, 제출 전에 반드시 멈춥니다.
2. **경력/성과를 조작하지 않습니다.** cv.md와 career-description.md에 있는 경험만 사용합니다.
3. **낮은 점수(3.0 미만) 공고 지원을 강력히 비추천합니다.**
4. **git push 전에 반드시 사용자 승인을 받습니다.** `git push origin main`을 실행하기 전에 커밋 내용을 보여주고 사용자에게 push 여부를 확인합니다. 자동으로 push하지 않습니다.
4. **모든 데이터는 cv.md, career-description.md에서 런타임에 읽습니다.** 하드코딩 금지.
5. **사람이 결정합니다.** AI는 평가하고 추천하되, 최종 결정은 사용자 몫입니다.

## 사용법

```
/career-ops-kr setup              # 원클릭 온보딩 (이력서 PDF → 자동 설정)
/career-ops-kr scan               # 한국 기업 채용 사이트 스캔
/career-ops-kr [URL 붙여넣기]     # 공고 평가
/career-ops-kr pdf [URL]          # 맞춤 이력서 PDF
/career-ops-kr 경력기술서 [URL]    # 맞춤 경력기술서 PDF
/career-ops-kr 자소서 [URL]       # 자기소개서 초안
/career-ops-kr 현황               # 지원 현황 보기
/career-ops-kr 조사 [기업명]      # 기업 심층 조사
/career-ops-kr 연락 [기업명]      # 링크드인 메시지 생성
```

## 파일 구조

```
cv.md                    # 이력서 원본 (사용자 작성)
career-description.md    # 경력기술서 원본 (사용자 작성)
config/profile.yml       # 사용자 프로필 (profile.example.yml에서 복사)
portals.yml              # 포털 설정 (portals.example.yml에서 복사)
data/applications.md     # 지원 현황 트래커 (자동 생성)
data/pipeline.md         # 미처리 공고 인박스 (자동 생성)
data/scan-history.tsv    # 스캔 이력 (자동 생성)
reports/                 # 평가 보고서 (자동 생성)
output/                  # 생성된 PDF (자동 생성)
```

## 온보딩 (첫 세션)

첫 세션에서 아래 항목을 확인합니다:

1. **cv.md** — 없으면 이력서 작성을 도와줍니다.
2. **career-description.md** — 없으면 경력기술서 작성을 도와줍니다.
3. **config/profile.yml** — 없으면 profile.example.yml을 복사하고 수정합니다.
4. **portals.yml** — 없으면 portals.example.yml을 복사합니다.

이후 사용자의 핵심 역량, 타겟 기업, 선호 조건을 파악하기 위한 질문을 합니다.

## PM 평가 기준

### 아키타입
- **Growth PM**: 그로스, 지표 중심, A/B 테스트, 퍼널 최적화
- **Platform PM**: 플랫폼, 인프라, 개발자 경험, API
- **B2B PM**: 기업용 제품, SaaS, 엔터프라이즈
- **Consumer PM**: 소비자 제품, UX, 리텐션
- **AI/Data PM**: AI 제품, 데이터 기반 의사결정

### 평가 점수
- 1.0 - 5.0 스케일
- 4.0 이상: 적극 지원 권장
- 3.0 - 3.9: 선택적
- 3.0 미만: 비추천

## 스캐닝 전략

- **Tier 1**: Playwright로 기업 자체 채용 사이트 직접 스캔
- **Tier 2**: WebSearch로 원티드/리멤버/링크드인/오퍼센트 탐색
- **Tier 3**: 사용자가 앱에서 발견한 공고 URL을 수동으로 투입

## 의존성

- Node.js + Playwright (PDF 생성용)
- Claude Code (AI 에이전트)
