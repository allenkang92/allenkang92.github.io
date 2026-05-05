---
title: "Review Report: Blog Layout Quality System"
date: 2026-05-05
author: Codex
status: Draft
base_commit: 40d60a8
related:
  prd: ./260505-prd-v1-by-codex.md
  hld: ./260505-hld-v1-by-codex.md
  lld: ./260505-lld-v1-by-codex.md
  tdd: ./260505-tdd-v1-by-codex.md
  adr: ./260505-adr-v1-by-codex.md
---

# 1. 검토 범위

서브에이전트 3개와 Codex 최종 검수로 다음 범위를 확인했다.

- 코드 회귀: Jekyll/Liquid/CSS/JS, 검색, 사이드바, baseurl, 빌드 호환성
- UX/접근성: 이미지 렌더링, 내비게이션 현재 위치, 키보드 검색, 포스트 목록, pagination, 목차, 대비
- 문서/콘텐츠 운영: README, AGENTS, DESIGN, BLOG_OPERATIONS, CONTENT_STRATEGY, `_config.yml`, series/tools/posts front matter

# 2. 검증 결과

## 완료된 검증

- `git diff --check` 통과
- `node --check assets/js/simple-search.js` 통과
- `node --check assets/js/main.js` 통과
- `node --check assets/js/tools.js` 통과
- `bundle exec jekyll build --destination /private/tmp/allenkang92-docs-build` 통과
- 첫 UI 개선 커밋 `40d60a8`은 `origin/main`에 push 완료

## 추가 코드 수정 반영

- 검색 clear affordance를 명시 버튼 1개로 복원하고 native clear 중복을 피했다.
- 검색 결과 재열기는 현재 input query와 기존 rendered query가 일치할 때만 동작하도록 제한했다.
- 검색 Arrow key handler는 focus가 검색 영역 안에 있을 때만 동작하도록 제한했다.
- 검색 URL 업데이트는 live input에서 `replaceState`, submit/clear에서 `pushState`를 사용하도록 분리했다.
- 검색 결과 count는 잘린 10개가 아니라 전체 match 수를 기준으로 footer에 표시한다.
- `/search.json` 경로는 Liquid `relative_url`로 form `data-search-url`에 주입한다.
- mint whale logo CSS 경로는 root-relative 대신 CSS 상대 경로로 바꿨다.
- 전역 이미지 opacity 문제를 override하고 lazy loader가 `data-src`, `data-srcset`, `source[data-srcset]`, `.loaded`를 처리하게 했다.
- 사이드바 nav는 하위 URL에서도 상위 섹션을 active로 표시하고 `aria-current`를 부여한다.
- site title은 홈 링크로 바꿨다.
- `DESIGN.md` 색상 토큰을 현재 mint theme와 맞췄다.

# 3. 발견 사항

## 필수: 처리 완료

### F-001 이미지가 전역 CSS 때문에 숨겨질 수 있음

- 근거: `assets/css/theme.css`의 `img { opacity: 0; }`, lazy loader의 `.loaded` 누락
- 영향: 포스트/프로젝트 이미지가 정보 전달에 실패할 수 있음
- 조치: `theme-atlas.css`에서 이미지 opacity fallback을 보장하고 `_includes/scripts.html` lazy loader를 수정함
- 상태: 완료

### F-002 하위 페이지에서 사이드바 현재 위치가 불명확함

- 근거: `page.url == item.url` exact match만 사용
- 영향: `/tools/*`, `/series/*`, `/posts/*`에서 현재 섹션 인식이 어려움
- 조치: 상위 경로 contains 기반 active 판정과 `aria-current` 추가
- 상태: 완료

### F-003 검색 Arrow key가 전역으로 결과 이동을 가로챌 수 있음

- 근거: `document.addEventListener('keydown')`가 검색 영역 focus 여부를 확인하지 않음
- 영향: 키보드 사용자가 예기치 않게 검색 결과로 이동할 수 있음
- 조치: 검색 영역 내부 focus와 결과 active 상태일 때만 Arrow navigation 수행
- 상태: 완료

## 권장: 처리 완료

### F-004 검색 clear UX와 stale result 재오픈

- 근거: clear button 제거 후 JS 흐름은 남아 있었고, `innerHTML.trim()`만으로 결과 재오픈 판단
- 영향: 검색어 지우기와 stale result 재표시가 불명확함
- 조치: clear button 복원, `lastRenderedQuery` 도입
- 상태: 완료

### F-005 root-relative asset/search path

- 근거: CSS logo 경로 `/assets/...`, 검색 경로 `/blog` 특수 처리
- 영향: baseurl 변경 시 자산/검색 경로 취약
- 조치: CSS 상대 경로와 Liquid `relative_url` 기반 `data-search-url` 사용
- 상태: 완료

### F-006 DESIGN 토큰 drift

- 근거: `DESIGN.md` 색상 값이 실제 `theme-atlas.css`와 다름
- 영향: 다음 UI 변경 시 잘못된 source of truth를 참조할 수 있음
- 조치: `DESIGN.md` 색상 토큰과 hover 정책 갱신
- 상태: 완료

# 4. 남은 리스크와 후속 과제

## P0/P1 후보

1. README 구조 갱신
   - 현재 README는 `_config/`, `_includes/meta`, `_projects` 등 실제 구조와 다른 설명이 있다.
   - post front matter 예시는 `category` 단수만 안내하지만 실제 구현은 `categories`, `series`, `series_order`, `date_modified`, `learning_outcomes`, `references`를 사용한다.

2. description 메타데이터 정책
   - 운영 문서는 `description` 확인을 요구하지만 기존 포스트 다수에 description이 없다.
   - fallback 허용 기준과 정적 검사 규칙이 필요하다.

3. 갱신일 정책
   - `date_modified`가 실제 사실 업데이트인지, 마이그레이션/스타일 정리인지 구분되지 않는다.
   - 오탈자, 메타데이터, 사실 업데이트, 구조 개편별 갱신일 변경 기준이 필요하다.

4. 시리즈 registry 도입
   - 시리즈 키/라벨/허브 URL/참고자료가 `_pages/series.html`, 개별 허브, `_layouts/post.html`에 반복된다.
   - `_data/series.yml` 같은 registry로 단일화하는 것이 좋다.

5. 검색 품질 정책
   - 현재 검색 색인은 본문 일부만 포함한다.
   - 한국어 한 글자 검색어 허용, 검색 색인 길이, 결과 정렬 정책을 문서화하고 테스트해야 한다.

## P2 후보

1. 포스트 목록의 반복 `읽기` 링크 접근성
   - 링크 이름이 반복되므로 `읽기: {post.title}` aria-label 또는 제목 링크만 남기는 선택이 필요하다.

2. pagination announcement
   - 페이지 이동 후 focus 이동과 `aria-live` 발표가 필요하다.

3. TOC anchor 안정성
   - Liquid split/slugify 기반 목차가 Kramdown heading id와 어긋날 수 있다.
   - 대표 한국어 글에서 링크 dead check가 필요하다.

4. 도구 상세 CTA state
   - `/tools/?tab=physics&formula=kinetic`처럼 상세 도구에서 바로 입력 상태로 진입하는 deep link가 있으면 좋다.

5. 작은 보조 텍스트 대비
   - `--atlas-muted`는 일부 작은 텍스트에서 4.5:1에 근접하거나 부족할 수 있다.

6. 언어 태그
   - About/Tools의 영어 문구는 `lang="en"` 또는 한국어 중심 정리가 필요하다.

7. Privacy note
   - GA4는 개인정보를 보내지 않도록 구현되어 있으나 footer/About에 짧은 privacy note가 있으면 신뢰 비용을 줄일 수 있다.

# 5. 문서화 반영

- PRD: `R-011` 이미지 렌더링, `R-012` 하위 nav state를 추가했다.
- HLD: 정적 사이트 품질 게이트와 운영 리스크를 정의했다.
- LLD: `M-012 Image Loader`, `M-013 Navigation State`를 추가했다.
- TDD: `T-015`, `T-016`을 추가하고 검색 clear button 기대값을 갱신했다.
- ADR: Jekyll 유지와 theme override 전략을 기록했다.

# 6. 결론

현재 변경은 정적 빌드와 JS 문법 검증을 통과했다. 즉시 수정 가능한 필수 회귀 후보는 코드에 반영했다. 남은 핵심 작업은 콘텐츠/운영 구조의 장기 정합성이다. 다음 단계에서는 README, front matter schema, `_data/series.yml`, 메타 description 검사, Playwright smoke test를 별도 작은 커밋으로 나누는 것이 안전하다.
