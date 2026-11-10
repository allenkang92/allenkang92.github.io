# Allen's Blog

Jekyll 기반 GitHub Pages 개인 블로그입니다. 수학철학·수학사, 과학철학·현대물리학, 웹 접근성, 작은 계산 도구를 함께 운영합니다.

## 구조

```text
.
├── _config.yml              # Jekyll 설정, build exclude, collection 설정
├── _data/                   # navigation, categories, series, tools registry
├── _includes/               # sidebar, search form, footer, category label
├── _layouts/                # default, post, achievement(s) layouts
├── _pages/                  # posts, series, about, tools, achievements pages
├── _posts/                  # 블로그 글
├── _achievements/           # achievement collection (성과 데이터의 단일 진실원)
├── frontend/posts/          # 검색·정렬·페이지네이션 React/TypeScript 앱
├── scripts/                 # 빌드 연결·사이트 산출물 검증
├── tests/                   # 검색/React와 front matter 계약 테스트
├── assets/
│   ├── css/                 # live CSS: main, search, sidebar-toggle, theme-atlas
│   ├── js/                  # main, search, tools, analytics events, 생성된 React 번들
│   └── images/              # logo, post assets, PDF archive
├── tools/                   # SEO용 개별 도구 랜딩 페이지
├── BLOG_OPERATIONS.md       # 운영 체크리스트, build 제외
├── CONTENT_STRATEGY.md      # 콘텐츠 전략, build 제외
├── DESIGN.md                # 디자인 토큰과 UI 운영 원칙, build 제외
└── docs/                    # PRD/HLD/LLD/TDD/ADR/review 문서, build 제외
```

## 실행

```bash
bundle install
npm ci
npm run serve
```

`npm run serve`는 React 앱을 먼저 빌드한 다음 Jekyll 서버를 실행합니다. 기본 주소는 `http://127.0.0.1:4000`입니다. 포트 충돌이 있으면 Jekyll `--port`를 지정합니다.

## 검증

변경 후 기본적으로 확인합니다.

```bash
npm run verify
```

`npm run verify`는 TypeScript 검사, 검색 모델·React DOM 테스트, front matter 테스트와 실제 `_posts` 메타데이터 검사, Vite 번들, Jekyll 산출물 연결, 생성 HTML의 의미 구조·접근 가능한 이름 단서·이미지 대체 텍스트·ID 참조·내부 링크·검색 데이터를 순서대로 검사합니다. 이 구조 검사는 WCAG 적합성 판정이나 실제 스크린 리더 동작 검증을 대신하지 않습니다. Jekyll 실행은 Ruby에 UTF-8 인코딩을 전달하므로 `LC_ALL=C` 환경에서도 별도 설정 없이 빌드할 수 있습니다. 소스 코드는 `frontend/posts/`에 두고, 브랜치 기반 GitHub Pages 배포가 그대로 정적 파일을 제공하도록 생성 번들과 `_data/vite_manifest.json`도 갱신 후 함께 커밋합니다. 저장소의 실제 Pages publish source는 아직 확인하지 않았으므로 배포 설정은 변경하지 않습니다.

시각 변경이 있으면 모바일 390px, 데스크톱 폭에서 `/`, `/posts/`, 대표 포스트, `/series/`, `/tools/`, `/about/`를 확인합니다.

## 글 front matter

새 글은 최소한 아래 값을 둡니다.

```yaml
---
layout: post
title: "글 제목"
description: "검색 결과와 공유 미리보기에 쓸 1문장 설명"
date: YYYY-MM-DD HH:MM:SS +0900
date_modified: YYYY-MM-DD HH:MM:SS +0900
last_modified_at: YYYY-MM-DD HH:MM:SS +0900
categories: [mathematics_philosophy_history]
series: "Mathematics-Philosophy-History"
series_order: 1
learning_outcomes:
  - "이 글에서 얻는 것 1"
  - "이 글에서 얻는 것 2"
  - "이 글에서 얻는 것 3"
references:
  - title: "참고자료명"
    url: "https://example.com"
---
```

마이그레이션 글은 `migrated_from`을 추가하고, 원문 작성일과 현재 블로그 갱신일을 구분합니다.

`categories`는 `_data/categories.yml`에 등록된 키를 배열로 사용합니다. 시리즈 글은 `_data/series.yml`의 `key`와 일치하는 `series`, 0 이상의 고유한 `series_order`가 필요합니다. 시리즈에 속하지 않는 글은 두 필드를 생략합니다. `date_modified`와 `last_modified_at`을 함께 쓰면 값이 같아야 합니다. 이 계약은 `npm run verify:frontmatter`로 확인할 수 있습니다.

## 데이터 registry

- 카테고리 라벨은 `_data/categories.yml`을 기준으로 합니다.
- 시리즈 라벨, 허브 URL, 대표 참고자료는 `_data/series.yml`을 기준으로 합니다.
- 도구 목록과 개별 랜딩 링크는 `_data/tools.yml`을 기준으로 합니다.

Liquid 템플릿에서 같은 라벨을 직접 `case`로 반복하지 않습니다.

## 운영 문서

`BLOG_OPERATIONS.md`, `CONTENT_STRATEGY.md`, `DESIGN.md`, `docs/`는 저장소 운영용 문서입니다. `_config.yml`의 `exclude`에 들어 있으므로 public site와 sitemap에는 노출하지 않습니다.
