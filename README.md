# career-ops-kr

한국 PM/PO 구직자를 위한 AI 구직 파이프라인. Claude Code 스킬로 동작하며, 채용 공고 자동 스캔, AI 평가, 맞춤 이력서/경력기술서 PDF 생성을 지원합니다.

> [santifer/career-ops](https://github.com/santifer/career-ops)를 기반으로 한국 PM 시장에 맞게 현지화한 프로젝트입니다.

## 주요 기능

- **채용 공고 탐색** — 주요 기업 공식 채용 페이지 및 검색 엔진을 활용한 PM 공고 수집
- **AI 공고 평가** — PM 5개 아키타입 기반, 10개 차원 가중 평가 (1.0-5.0 스케일)
- **맞춤 이력서 PDF** — JD 키워드 반영, Pretendard 한글 폰트, ATS 최적화
- **경력기술서 자동 생성** — 프로젝트별 STAR 형식, JD에 맞게 재구성
- **자기소개서 초안** — 문항 기반 한국식 자소서 작성 지원
- **웹 대시보드** — 지원 현황 시각화 (점수 분포, 상태별 통계, 필터링)
- **링크드인 아웃리치** — 한국 비즈니스 톤에 맞는 메시지 생성
- **기업 심층 조사** — PM 관점 제품 분석, 조직 문화, 면접 대비 포인트

## 스크린샷

대시보드에서 `examples/applications-sample.md`를 로드하면 아래와 같은 화면을 볼 수 있습니다.

```
┌─────────────────────────────────────────────────────┐
│  career-ops-kr                  [데이터 로드] [새로고침] │
│                                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ 전체 15 │ │ 지원 7  │ │ 면접 2  │ │ Top≥4 7│       │
│  └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                      │
│  [점수 분포 차트]          [상태별 현황 차트]            │
│                                                      │
│  ★4.5 토스 | PM, 토스페이 | 지원완료                   │
│  ★4.4 네이버 | PM, AI 서비스 | 면접                    │
│  ★4.3 카카오 | Product Manager | 평가완료              │
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

## 빠른 시작

### 1. 설치

```bash
git clone https://github.com/jinjin1/career-ops-kr.git
cd career-ops-kr
npm install
npm run setup  # Playwright + Pretendard 폰트 설치
```

### 2. 온보딩 (이력서 PDF만 있으면 됩니다)

Claude Code에서 실행:

```
/career-ops-kr setup
```

대화형 온보딩이 시작됩니다:
- 이력서 PDF/Word/마크다운을 투입하면 자동으로 `cv.md` 생성
- 경력기술서 스켈레톤 자동 생성
- PM 아키타입, 관심 기업, 연봉 등 프로필 설정
- 완료 후 첫 스캔까지 약 5분

> 이력서 파일이 없어도 대화형으로 직접 입력할 수 있습니다.

### 3. 사용

Claude Code에서 슬래시 커맨드로 실행합니다:

```
/career-ops-kr scan              # 채용 공고 스캔
/career-ops-kr [URL 붙여넣기]     # 공고 평가
/career-ops-kr pdf [URL]          # 맞춤 이력서 PDF
/career-ops-kr 경력기술서 [URL]    # 경력기술서 PDF
/career-ops-kr 자소서 [URL]       # 자기소개서 초안
/career-ops-kr 현황               # 지원 현황
/career-ops-kr 조사 [기업명]      # 기업 심층 조사
/career-ops-kr 연락 [기업명]      # 링크드인 메시지
```

## 아키텍처

```
사용자 입력 (URL/명령어)
       │
       ▼
┌─────────────────┐
│   SKILL.md      │  ← 슬래시 커맨드 라우터
│   (라우터)       │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│_shared │ │ modes/*.md  │  ← 10개 모드
│ .md    │ │ (scan,      │
│(공유   │ │  evaluate,  │
│ 설정)  │ │  pdf, ...)  │
└────────┘ └─────┬──────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌─────────┐ ┌──────────┐
│data/   │ │reports/ │ │output/   │
│(트래커)│ │(보고서) │ │(PDF)     │
└───┬────┘ └─────────┘ └──────────┘
    │
    ▼
┌──────────────┐
│  dashboard/  │  ← 웹 대시보드 (HTML/JS/Chart.js)
│  index.html  │
└──────────────┘
```

## PM 평가 시스템

### 아키타입 (5종)

| 아키타입 | 핵심 키워드 |
|----------|------------|
| Growth PM | 그로스, 지표, A/B 테스트, 퍼널 최적화 |
| Platform PM | 플랫폼, 인프라, 개발자 경험, API |
| B2B PM | 기업용 제품, SaaS, 엔터프라이즈 |
| Consumer PM | 소비자 제품, UX, 리텐션 |
| AI/Data PM | AI 제품, 데이터 기반 의사결정 |

### 평가 스케일

| 점수 | 판정 |
|------|------|
| 4.0-5.0 | 적극 지원 |
| 3.0-3.9 | 선택적 지원 |
| 2.0-2.9 | 신중 검토 |
| 1.0-1.9 | 비추천 |

10개 차원(역할 매칭, 도메인, 직급, 보상, 성장, 문화, 제품 복잡도, 팀 구조, 기술 스택, 리모트)에 가중치를 적용하여 종합 점수를 산출합니다.

## 공고 탐색 방식

다양한 방법으로 PM 채용 공고를 수집합니다.

- **기업 공식 채용 페이지 확인** — 카카오, 토스, 네이버, 당근, 쿠팡 등 주요 기업
- **검색 엔진 활용** — Google 검색으로 채용 플랫폼 및 기업 사이트의 PM 공고 탐색
- **URL 직접 투입** — 원티드, 리멤버, 링크드인 등에서 발견한 공고 URL을 붙여넣으면 자동 평가

`portals.yml`에서 관심 기업과 검색 키워드를 설정할 수 있습니다.

## 파일 구조

```
career-ops-kr/
├── CLAUDE.md                    # 에이전트 지시사항
├── .claude/skills/career-ops-kr/
│   └── SKILL.md                 # 슬래시 커맨드 라우터
├── modes/                       # 10개 모드
│   ├── _shared.md               # PM 아키타입, 평가 기준
│   ├── evaluate.md              # 공고 평가
│   ├── scan.md                  # 포털 스캔
│   ├── pdf.md                   # 이력서 PDF
│   ├── career-desc.md           # 경력기술서
│   ├── cover-letter.md          # 자기소개서
│   ├── pipeline.md              # 파이프라인 관리
│   ├── tracker.md               # 지원 현황
│   ├── contact.md               # 링크드인 메시지
│   ├── deep.md                  # 기업 심층 조사
│   └── setup.md                 # 원클릭 온보딩
├── templates/
│   ├── cv-template.html         # 이력서 HTML (Pretendard)
│   ├── career-desc-template.html
│   ├── portals.example.yml      # 포털 설정 예시
│   └── states.yml               # 상태 정의
├── dashboard/                   # 웹 대시보드
│   ├── index.html
│   ├── parser.js
│   ├── dashboard.js
│   └── style.css
├── examples/                    # 예시 파일
│   ├── cv-example.md
│   ├── career-desc-example.md
│   └── applications-sample.md
├── config/
│   └── profile.example.yml      # 프로필 템플릿
├── generate-pdf.mjs             # PDF 생성기
└── package.json
```

## 사용자가 작성하는 파일 (gitignore됨)

| 파일 | 설명 |
|------|------|
| `cv.md` | 본인 이력서 |
| `career-description.md` | 본인 경력기술서 |
| `config/profile.yml` | 프로필 설정 |
| `portals.yml` | 포털 설정 (커스터마이즈) |
| `data/applications.md` | 지원 현황 (자동 생성) |
| `data/pipeline.md` | 미처리 공고 (자동 생성) |
| `reports/` | 평가 보고서 (자동 생성) |
| `output/` | 생성된 PDF (자동 생성) |

## 요구사항

- [Claude Code](https://claude.ai/code) (Claude Code CLI)
- Node.js 18+
- Playwright (`npm run setup`으로 자동 설치)

## 기여하기

이슈와 PR을 환영합니다.

1. Fork 후 feature 브랜치 생성
2. 변경사항 커밋
3. PR 생성

새로운 모드 추가, 채용 사이트 지원 확대, 대시보드 기능 개선 등을 기다리고 있습니다.

## 라이선스

MIT License. [santifer/career-ops](https://github.com/santifer/career-ops)를 기반으로 합니다.

## Credits

- 원본 프로젝트: [santifer/career-ops](https://github.com/santifer/career-ops) by Santiago Ferreira
- 한글 폰트: [Pretendard](https://github.com/orioncactus/pretendard) (SIL Open Font License)
- 차트: [Chart.js](https://www.chartjs.org/) (MIT License)
