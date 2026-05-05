---
title: "ADR: Use Jekyll Static Site With Theme Override Quality Layer"
version: v1
date: 2026-05-05
author: Codex
status: Accepted
related:
  prd: ./260505-prd-v1-by-codex.md
  hld: ./260505-hld-v1-by-codex.md
  lld: ./260505-lld-v1-by-codex.md
---

# ADR-001: Jekyll 정적 사이트를 유지하고 `theme-atlas.css`를 품질 override 계층으로 사용한다

## 상태

Accepted

## 맥락

Allen's Blog는 GitHub Pages 기반 Jekyll 블로그다. 기존 스타일은 SCSS 컴파일 결과, 검색 CSS, 페이지별 인라인 `<style>`, 새 테마 override가 함께 존재한다. 이 구조에서 전체 리라이트를 진행하면 블로그 콘텐츠와 배포 안정성에 큰 영향을 줄 수 있다.

사용자는 픽셀/터미널 느낌에서 벗어나 민트/파스텔 계열의 차분한 연구형 블로그를 원한다. 동시에 포스트, 검색, 사이드바, 도구, 소개 페이지가 실사용 가능한 UI로 정렬되어야 한다.

## 결정

- Jekyll/GitHub Pages 구조를 유지한다.
- 대규모 framework migration은 하지 않는다.
- 최종 시각 품질 규칙은 `assets/css/theme-atlas.css`에 둔다.
- 사이드바 토글의 독립 스타일은 `assets/css/sidebar-toggle.css`에 유지하되 색상은 theme token과 맞춘다.
- 검색 동작은 `assets/js/simple-search.js`에서 정적 `/search.json` 기반으로 유지한다.
- 운영과 설계 의사결정은 `docs/`에 PRD/HLD/LLD/TDD/ADR/검토 보고서로 남긴다.

## 근거

- GitHub Pages 호환성을 유지할 수 있다.
- 기존 콘텐츠와 Liquid layout을 보존하면서 UI를 빠르게 안정화할 수 있다.
- 전역 override 계층을 두면 페이지별 인라인 스타일의 충돌을 통제할 수 있다.
- 개인 블로그 규모에서는 클라이언트 검색과 정적 빌드가 운영 복잡도를 낮춘다.

## 대안

### 대안 A: Next.js 또는 Astro로 마이그레이션

- 장점: 컴포넌트 구조와 E2E 환경을 체계화하기 쉽다.
- 단점: 현재 콘텐츠, GitHub Pages 설정, Liquid template, 검색 구조를 대규모로 바꿔야 한다.
- 결론: 현재 요구 범위보다 리스크가 크다.

### 대안 B: 기존 SCSS를 전면 정리

- 장점: 중복 CSS와 override 난이도를 줄일 수 있다.
- 단점: 변경 범위가 넓고 회귀 검증 비용이 크다.
- 결론: 별도 refactor phase에서 진행한다.

### 대안 C: 페이지별 인라인 style을 계속 추가

- 장점: 빠르게 특정 페이지를 고칠 수 있다.
- 단점: 색상, 간격, hover 상태가 다시 분기된다.
- 결론: 새 변경 방식으로 채택하지 않는다.

## 결과

## 긍정적 영향

- 배포 구조가 단순하다.
- 사용자가 본 화면을 빠르게 개선할 수 있다.
- 운영 문서와 테스트 설계로 향후 변경 기준을 남긴다.

## 부정적 영향

- `theme-atlas.css`의 specificity가 높아진다.
- legacy CSS와 page-level style이 남아 있어 장기적으로 부채가 된다.
- 디자인 토큰 source of truth가 `DESIGN.md`와 CSS 사이에 나뉘어 있다.

## 후속 조치

- `DESIGN.md` 토큰을 최신 `theme-atlas.css`와 동기화한다.
- page-level `<style>`을 단계적으로 SCSS 또는 theme override로 이동한다.
- Playwright smoke test를 저장소에 추가한다.
- GA4/Search Console 실제 콘솔 상태를 운영 체크리스트에 기록한다.
