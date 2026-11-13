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

변경 후 기본적으로 확인합니다. 최초 1회는 [SEO 2.8 격리 회귀 시험 설치 안내](tests/seo/legacy/README.md)에 따라 별도 번들을 설치하고, 이후 전체 검증을 실행할 셸에서 `SEO_LEGACY_BUNDLE_PATH`에 설치 경로를 지정합니다. 이 경로가 없거나 잘못됐으면 `npm run verify`는 실패하며 해당 시험을 조용히 건너뛰지 않습니다.

```bash
npm run verify
```

`npm run verify`는 TypeScript 검사, 검색 모델·React DOM 테스트, front matter 테스트와 실제 `_posts` 메타데이터 검사, Vite 번들, Jekyll 산출물 연결, SEO 2.8 격리 회귀 시험, 생성 HTML의 의미 구조·접근 가능한 이름 단서·이미지 대체 텍스트·ID 참조·내부 링크·검색 데이터를 순서대로 검사합니다. 이 구조 검사는 WCAG 적합성 판정이나 실제 스크린 리더 동작 검증을 대신하지 않습니다. SEO 격리 시험도 GitHub Pages 전체 환경의 재현은 아닙니다. Jekyll 실행은 Ruby에 UTF-8 인코딩을 전달하므로 `LC_ALL=C` 환경에서도 별도 설정 없이 빌드할 수 있습니다. 소스 코드는 `frontend/posts/`에 두고, 브랜치 기반 GitHub Pages 배포가 그대로 정적 파일을 제공하도록 생성 번들과 `_data/vite_manifest.json`도 갱신 후 함께 커밋합니다.

프런트엔드 빌드는 캐시된 이전 HTML에서 참조할 수 있는 기존 해시 번들을 자동 삭제하지 않습니다. 매니페스트는 최신 번들을 가리킵니다. 이전 번들이 쌓일 수 있으므로 배포 환경의 HTML 캐시 정책과 참조 관계를 확인해 보존 기간을 정하고, 정리 전에 이전 페이지에 미치는 영향을 확인합니다.

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

글 참고자료의 제목이 문서 언어와 다르면 해당 항목에 `lang: en`처럼 언어를 명시합니다. 언어 속성은 제목에만 적용되며, 생략하면 문서 언어를 상속합니다. `note`는 별도로 문서 언어를 상속합니다.

글의 기존 제목 ID와 퍼센트 인코딩 형태의 다른 ID가 같은 주소로 해석되어 목차 대상이 충돌한다면, 기존 제목 ID를 유지하고 해당 제목 안에 고유한 정적 별칭을 지정할 수 있습니다.

```markdown
## <span id="toc-korean"></span>한글 제목
{: id="가" data-toc-fragment="toc-korean"}
```

별칭은 영문자로 시작하고 영문자·숫자·마침표·밑줄·하이픈만 사용합니다. 제목 맨 앞의 빈 `span`으로 두고 숨김 속성이나 숨김 스타일을 적용하지 않습니다. ID는 문서 전체의 다른 ID나 레거시 앵커 `name`과 겹치지 않아야 합니다. 유효한 별칭이 있을 때만 목차가 해당 주소를 사용하며, 원래 제목 ID와 외부 주소는 바꾸지 않습니다. 잘못된 별칭은 기존 제목 주소로 처리합니다. `npm run test:integration`의 생성된 글 목차 검사는 구조·ID·HTML 숨김 속성과 문서 내부 스타일을 검사하지만 외부 스타일시트나 모든 화면 크기의 숨김 여부를 대신 확인하지는 않으므로 실제 브라우저에서도 확인해야 합니다. 이 기능은 작성자가 별칭을 지정한 충돌에 적용되며, 모든 충돌을 자동으로 수정하지는 않습니다.

목차 주소를 스크립트가 차단된 환경에서도 공유하려면 본문의 제목에 정적 ID 또는 유효한 정적 별칭이 있어야 합니다. 일반 Markdown 제목에는 Kramdown이 ID를 생성하지만, 원시 HTML 제목에는 고유한 ID를 직접 지정합니다. 이미 게시한 글을 바꿀 때는 기존 목차 주소를 먼저 기록해 변경 전후를 비교합니다. `npm run test:integration`은 생성물에서 목차 링크가 스크립트 없는 문서의 같은 제목 또는 정적 별칭을 가리키는지 검사하며, 현재 브랜치 기반 Pages 배포가 이 검사를 자동 실행하는 것은 아닙니다.

`categories`는 `_data/categories.yml`에 등록된 키를 배열로 사용합니다. 시리즈 글은 `_data/series.yml`의 `key`와 일치하는 `series`, 0 이상의 고유한 `series_order`가 필요합니다. 시리즈에 속하지 않는 글은 두 필드를 생략합니다. `date_modified`와 `last_modified_at`을 함께 쓰면 값이 같아야 합니다. 이 계약은 `npm run verify:frontmatter`로 확인할 수 있습니다.

## 데이터 registry

- 카테고리 라벨은 `_data/categories.yml`을 기준으로 합니다.
- 시리즈 라벨, 허브 URL, 대표 참고자료는 `_data/series.yml`을 기준으로 합니다.
- 시리즈 참고자료는 기존 문자열 또는 `title`과 선택적 `lang`을 가진 객체로 적습니다. 객체의 제목은 텍스트로 이스케이프하고, 기존 문자열은 기존 표시 방식을 유지합니다. `kicker_lang`을 생략하면 문서 언어를 상속합니다.
- 도구 목록과 개별 랜딩 링크는 `_data/tools.yml`을 기준으로 합니다.
- `tools/`의 정적 도구 안내는 `search_index_body: true`를 명시한 경우에만 본문을 검색 색인에 넣습니다. 네 안내 페이지 외 일반 페이지는 제목과 설명만 검색합니다. 본문 색인 대상에 스크립트·숨김 내용·출력 텍스트 내 Liquid를 넣지 않으며, 대상 추가 시 `tests/posts/search-index.integration.test.mjs`에 추가하고 생성 색인과 실제 표시 본문을 비교합니다. 이 검사는 모든 외부 CSS의 가시성까지 보장하지 않습니다.

Liquid 템플릿에서 같은 라벨을 직접 `case`로 반복하지 않습니다.

## 운영 문서

`BLOG_OPERATIONS.md`, `CONTENT_STRATEGY.md`, `DESIGN.md`, `docs/`는 저장소 운영용 문서입니다. `_config.yml`의 `exclude`에 들어 있으므로 public site와 sitemap에는 노출하지 않습니다.
