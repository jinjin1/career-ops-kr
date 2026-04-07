# 파이프라인 관리 (pipeline)

이 모드는 `data/pipeline.md`에 있는 미처리 공고를 관리합니다.

## 사전 조건

- `data/pipeline.md`가 존재해야 합니다. 없으면 scan 모드를 먼저 실행하세요.
- `data/applications.md`가 존재해야 합니다. 없으면 빈 파일로 생성합니다.
- evaluate 모드의 사전 조건(cv.md, career-description.md)이 충족되어야 합니다.

## 실행 절차

### 1. 파이프라인 현황 보기

`data/pipeline.md`를 읽어 미처리 공고 목록을 보여줍니다:

```
=== 파이프라인 현황 ===
미처리 공고: 12건

1. [ ] [카카오] Product Manager, 카카오톡 (발견일: 2026-04-07)
2. [ ] [토스] PM, 토스페이 결제 (발견일: 2026-04-07)
3. [ ] [당근] 서비스기획자 (발견일: 2026-04-06)
...
```

### 2. 공고 처리

파이프라인의 각 공고에 대해:
1. URL을 방문하여 JD를 읽습니다.
2. `evaluate` 모드를 실행하여 평가합니다.
3. 평가 결과에 따라 `data/applications.md`에 기록합니다.
4. `data/pipeline.md`에서 해당 항목을 체크합니다 (`[x]`).

### 3. URL 직접 투입

사용자가 URL을 붙여넣으면:
1. pipeline.md에 추가합니다.
2. 즉시 evaluate 모드를 실행합니다.
3. 결과를 applications.md에 기록합니다.

## 파이프라인 파일 형식

```markdown
# 미처리 공고

- [ ] [카카오] Product Manager, 카카오톡 — https://careers.kakao.com/jobs/xxx (발견일: 2026-04-07)
- [x] [토스] PM, 토스페이 결제 — https://toss.im/career/job-detail?job_id=xxx (발견일: 2026-04-07) → 보고서 #003
- [ ] [당근] 서비스기획자 — https://about.daangn.com/jobs/xxx (발견일: 2026-04-06)
```

## 일괄 처리

`/career-ops-kr pipeline process` 명령으로 미처리 공고를 순차적으로 처리합니다:
- 각 공고에 대해 evaluate → 보고서 생성 → 트래커 기록
- 진행 상황을 실시간으로 보여줍니다
- 중간에 중단해도 이미 처리된 항목은 유지됩니다

## 출력

처리 완료 후 업데이트되는 파일:

| 파일 | 설명 |
|------|------|
| `data/pipeline.md` | 처리된 항목을 `[x]`로 체크 |
| `data/applications.md` | 평가 결과 추가 (점수, 상태, 보고서 링크) |
| `reports/{번호}.md` | 각 공고별 평가 보고서 |

## 윤리 규칙

- 평가 결과에 관계없이 **지원서를 자동 제출하지 않습니다.** 평가와 보고서 생성까지만 자동화합니다.
- 일괄 처리 시 각 공고를 성실하게 평가합니다. 속도를 위해 평가 품질을 낮추지 않습니다.
- 사용자가 직접 투입한 URL의 평가도 동일한 기준을 적용합니다.
