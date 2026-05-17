# Allen's Blog

Jekyll 기반 GitHub Pages 개인 블로그입니다. 수학철학·수학사, 과학철학·현대물리학, 웹 접근성, 작은 계산 도구를 함께 운영합니다.

## 구조

```text
.
├── _config.yml              # Jekyll 설정, build exclude, collection 설정
├── _data/                   # navigation, categories, series, tools registry
├── _includes/               # sidebar, search form, footer, category label
├── _layouts/                # default, post, category, project, achievement layouts
├── _pages/                  # posts, series, about, tools, achievements pages
├── _posts/                  # 블로그 글
├── _achievements/           # achievement collection
├── _achievement_categories/  # achievement category pages
├── _subcategories/          # category/subcategory metadata
├── assets/
│   ├── css/                 # live CSS: main, search, sidebar-toggle, theme-atlas
│   ├── js/                  # main, search, posts, tools, analytics events
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
bundle exec jekyll serve
```

기본 주소는 `http://127.0.0.1:4000`입니다. 포트 충돌이 있으면 `--port`를 지정합니다.

## 검증

변경 후 기본적으로 확인합니다.

```bash
node --check assets/js/main.js
node --check assets/js/simple-search.js
node --check assets/js/posts.js
node --check assets/js/tools.js
node --check assets/js/analytics-events.js
bundle exec jekyll build
```

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

## 데이터 registry

- 카테고리 라벨은 `_data/categories.yml`을 기준으로 합니다.
- 시리즈 라벨, 허브 URL, 대표 참고자료는 `_data/series.yml`을 기준으로 합니다.
- 도구 목록과 개별 랜딩 링크는 `_data/tools.yml`을 기준으로 합니다.

Liquid 템플릿에서 같은 라벨을 직접 `case`로 반복하지 않습니다.

## 운영 문서

`BLOG_OPERATIONS.md`, `CONTENT_STRATEGY.md`, `DESIGN.md`, `docs/`는 저장소 운영용 문서입니다. `_config.yml`의 `exclude`에 들어 있으므로 public site와 sitemap에는 노출하지 않습니다.
