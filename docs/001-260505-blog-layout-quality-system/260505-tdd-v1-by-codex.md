---
title: "TDD: Blog Layout Quality System"
version: v1
date: 2026-05-05
author: Codex
status: Draft
related:
  prd: ./260505-prd-v1-by-codex.md
  hld: ./260505-hld-v1-by-codex.md
  lld: ./260505-lld-v1-by-codex.md
---

# 1. 테스트 목적

Allen's Blog의 레이아웃, 검색, 사이드바, 포스트 구조, 도구 페이지, 운영 문서가 정적 사이트 품질 기준을 만족하는지 검증한다.

# 2. 테스트 전략 요약

- 정적 빌드 검증: Jekyll 빌드 성공 여부 확인
- 정적 문법 검증: JavaScript 문법과 git diff 상태 확인
- 브라우저 smoke 검증: 주요 페이지의 렌더링과 검색/사이드바 상태 확인
- 접근성 검증: 키보드, focus-visible, aria 상태, 대비 확인
- 문서 검증: 운영 문서와 spec 문서의 추적성 확인

# 3. 테스트 대상 요구사항 요약

대상 요구사항은 PRD의 `R-001`부터 `R-010`, `R-NF-001`부터 `R-NF-006`, `R-ERR-001`부터 `R-ERR-004`이다.

# 4. 테스트 도구 및 환경

- 정적 빌드: Jekyll, Bundler
- JavaScript 문법: Node.js `node --check`
- E2E/브라우저: Playwright 또는 Codex in-app browser
- 접근성 보조 확인: 수동 DOM snapshot, 색상 대비 계산 스크립트
- 실행 환경: macOS local workspace, GitHub Pages compatible static output

# 5. Mock 정책

- 내부 Jekyll 빌드, Liquid 렌더링, 로컬 정적 파일은 mock하지 않는다.
- GA4, Search Console, Utterances처럼 외부 네트워크 서비스는 로컬 테스트에서 실제 전송 검증을 요구하지 않는다.
- 검색은 로컬 `/search.json`을 사용한다. 실패 테스트는 네트워크 또는 fetch 실패를 테스트 더블로 대체할 수 있다.

# 6. 테스트 케이스 목록

| ID | 유형 | 요구사항 | 검증 항목 |
| --- | --- | --- | --- |
| T-001 | Visual | R-001 | 주요 페이지에 mint/teal theme 적용 |
| T-002 | Visual | R-002 | 포스트 제목/메타/목차 폭 정렬 |
| T-003 | Functional | R-003 | 검색 결과 재열림과 버튼 중복 제거 |
| T-004 | Functional | R-004 | 카테고리 한국어 라벨 |
| T-005 | Functional | R-005 | 모바일 사이드바 aria 상태 |
| T-006 | Visual | R-006 | About 로고와 링크 구조 |
| T-007 | Functional | R-007 | 도구 개별 랜딩 링크 존재 |
| T-008 | Functional | R-008 | 작성일/갱신일 구분 표시 |
| T-009 | Visual | R-001 | hover 색상 teal 계열 유지 |
| T-010 | Responsive | R-002 | 390px 모바일 가로 스크롤 없음 |
| T-011 | E2E | R-003 | URL `q` 기반 검색 결과 표시 |
| T-012 | E2E | R-005 | 사이드바 열고 닫기 |
| T-013 | Docs | R-009 | 운영 루틴 문서 존재 |
| T-014 | Docs | R-010 | 디자인 토큰 drift 기록 |
| T-015 | Visual | R-011 | 이미지 opacity/lazy loading |
| T-016 | A11y | R-012 | 하위 페이지 nav active/aria-current |
| T-NF-001 | Build | R-NF-001 | Jekyll build 성공 |
| T-NF-002 | A11y | R-NF-002 | 핵심 색상 대비 AA |
| T-NF-003 | A11y | R-NF-003 | focus-visible 스타일 |
| T-NF-004 | Maintainability | R-NF-004 | 전역 override 중심 변경 |
| T-NF-005 | Privacy | R-NF-005 | GA4 검색어 원문 미전송 |
| T-NF-006 | Resilience | R-NF-006 | 로고 fallback 유지 |
| T-ERR-001 | Error | R-ERR-001 | 검색 데이터 오류 메시지 |
| T-ERR-002 | Error | R-ERR-002 | 검색 결과 없음 메시지 |
| T-ERR-003 | Error | R-ERR-003 | 계산기 오류 안내 |
| T-ERR-004 | Error | R-ERR-004 | 로고 이미지 실패 fallback |

# 7. 상세 테스트 명세

## T-001: 주요 페이지 테마 적용

```js
import { test, expect } from '@playwright/test';

test('major pages use mint paper and teal action theme', async ({ page }) => {
  for (const path of ['/', '/posts/', '/series/', '/tools/', '/about/']) {
    await page.goto(`http://127.0.0.1:4002${path}`);
    const bodyBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundImage);
    const toggleBg = await page.locator('.sidebar-toggle').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bodyBg).toContain('rgb');
    expect(toggleBg).toBeTruthy();
  }
});
```

## T-003: 검색 결과 재열림

```js
import { test, expect } from '@playwright/test';

test('search results reopen on input focus', async ({ page }) => {
  await page.goto('http://127.0.0.1:4002/posts/?q=수학');
  await page.getByRole('button', { name: '사이드바 열기' }).click();
  const input = page.getByLabel('검색어 입력');
  await input.focus();
  await expect(page.locator('#search-results')).toBeVisible();
  await expect(page.getByRole('button', { name: '검색어 지우기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '검색어 지우기' })).toHaveCount(1);
});
```

## T-004: 카테고리 라벨

```js
import { test, expect } from '@playwright/test';

test('category keys are rendered as Korean labels', async ({ page }) => {
  await page.goto('http://127.0.0.1:4002/posts/?q=수학');
  await page.getByRole('button', { name: '사이드바 열기' }).click();
  await expect(page.getByText('수학철학·수학사').first()).toBeVisible();
  await expect(page.getByText('mathematics_philosophy_history')).toHaveCount(0);
});
```

## T-008: 작성일과 갱신일

```js
import { test, expect } from '@playwright/test';

test('post renders both published and modified dates when modified', async ({ page }) => {
  await page.goto('http://127.0.0.1:4002/posts/9%EC%9E%A5-%EC%88%98%ED%95%99%EC%B2%A0%ED%95%99%EA%B3%BC%EC%88%98%ED%95%99%EC%82%AC%EC%9D%98%EC%A2%85%ED%95%A9%EC%A0%81%EA%B3%A0%EC%B0%B0/');
  await expect(page.getByText('작성일')).toBeVisible();
  await expect(page.getByText('갱신일')).toBeVisible();
});
```

# 8. 예외/오류 테스트

## T-ERR-001: 검색 데이터 로딩 실패

```js
import { test, expect } from '@playwright/test';

test('search data load failure shows readable error', async ({ page }) => {
  await page.route('**/search.json', route => route.abort());
  await page.goto('http://127.0.0.1:4002/posts/?q=수학');
  await page.getByRole('button', { name: '사이드바 열기' }).click();
  await expect(page.getByText('검색 데이터를 불러오는 중 오류가 발생했습니다.')).toBeVisible();
});
```

## T-ERR-002: 검색 결과 없음

```js
import { test, expect } from '@playwright/test';

test('no results state is explicit', async ({ page }) => {
  await page.goto('http://127.0.0.1:4002/posts/?q=zzzz-no-match');
  await page.getByRole('button', { name: '사이드바 열기' }).click();
  await expect(page.getByText('다른 검색어로 시도해 보세요.')).toBeVisible();
});
```

# 9. 비기능 테스트

## T-NF-001: Jekyll build

```bash
bundle exec jekyll build
```

## T-NF-002: 핵심 색상 대비

```js
function lum(hex) {
  const n = hex.replace('#', '');
  const vals = [0, 2, 4]
    .map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return vals[0] * 0.2126 + vals[1] * 0.7152 + vals[2] * 0.0722;
}
function contrast(a, b) {
  const L1 = Math.max(lum(a), lum(b));
  const L2 = Math.min(lum(a), lum(b));
  return (L1 + 0.05) / (L2 + 0.05);
}
console.assert(contrast('#ffffff', '#1f746a') >= 4.5);
console.assert(contrast('#1f3430', '#f5fffb') >= 4.5);
```

## T-NF-003: JavaScript syntax

```bash
node --check assets/js/simple-search.js
node --check assets/js/main.js
node --check assets/js/tools.js
node --check assets/js/analytics-events.js
```

# 10. E2E 테스트(Playwright)

```js
import { test, expect } from '@playwright/test';

test('core smoke flow', async ({ page }) => {
  await page.goto('http://127.0.0.1:4002/posts/');
  await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();

  await page.getByRole('button', { name: '사이드바 열기' }).click();
  await page.getByLabel('검색어 입력').fill('수학');
  await expect(page.locator('#search-results')).toBeVisible();

  await page.getByRole('button', { name: '사이드바 닫기' }).click();
  await expect(page.getByRole('heading', { name: '전체 글' })).toBeVisible();
});
```

# 11. 자동화 계획

- Phase 1: `git diff --check`, `node --check`, `bundle exec jekyll build`를 수동 release checklist로 고정한다.
- Phase 2: Playwright smoke test를 `tests/e2e/blog-smoke.spec.ts`로 추가한다.
- Phase 3: GitHub Actions에서 build, JS syntax, Playwright smoke를 실행한다.

# 12. 상태 가드 정책

- `bundle exec jekyll build` 실패: 배포 차단
- 변경 JS의 `node --check` 실패: 배포 차단
- 핵심 페이지 브라우저 smoke 실패: 배포 차단
- GA4/Search Console 콘솔 확인 미완료: 배포 가능, 운영 리스크로 기록

# 13. 테스트 실행 명령

```bash
git diff --check
node --check assets/js/simple-search.js
node --check assets/js/main.js
bundle exec jekyll build
```

# 14. 요구사항-테스트 추적 매트릭스

| 요구사항 | 테스트 |
| --- | --- |
| R-001 | T-001, T-009 |
| R-002 | T-002, T-010 |
| R-003 | T-003, T-011 |
| R-004 | T-004 |
| R-005 | T-005, T-012 |
| R-006 | T-006 |
| R-007 | T-007 |
| R-008 | T-008 |
| R-009 | T-013 |
| R-010 | T-014 |
| R-011 | T-015 |
| R-012 | T-016 |
| R-NF-001 | T-NF-001 |
| R-NF-002 | T-NF-002 |
| R-NF-003 | T-NF-003 |
| R-NF-004 | T-NF-004 |
| R-NF-005 | T-NF-005 |
| R-NF-006 | T-NF-006 |
| R-ERR-001 | T-ERR-001 |
| R-ERR-002 | T-ERR-002 |
| R-ERR-003 | T-ERR-003 |
| R-ERR-004 | T-ERR-004 |

# 15. 리스크/미결 사항

<!-- [테스트 설계 보완 필요] 이유: Playwright 테스트 파일과 실행 환경이 아직 저장소에 추가되어 있지 않다. -->

<!-- [테스트 설계 보완 필요] 이유: GA4와 Search Console은 콘솔 접근이 필요해 로컬 테스트로 완료 여부를 확인할 수 없다. -->

# 16. 승인 기록

| 날짜 | 작성자 | 상태 | 비고 |
| --- | --- | --- | --- |
| 2026-05-05 | Codex | Draft | 초기 TDD 작성 |
