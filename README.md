# Allen의 블로그

Allen의 개인 블로그입니다.

## 디렉토리 구조

```
allenkang92.github.io/
├── _config/                      # 설정 파일
│   ├── development.yml          # 개발 환경 설정
│   └── production.yml           # 운영 환경 설정
├── _data/                        # 데이터 파일
│   ├── navigation.yml           # 네비게이션 메뉴 구조
│   ├── social.yml               # 소셜 미디어 링크
│   └── categories.yml           # 블로그 카테고리
├── _includes/                    # 재사용 가능한 컴포넌트
│   ├── components/              # UI 컴포넌트
│   │   ├── header.html         # 헤더
│   │   ├── footer.html         # 푸터
│   │   ├── sidebar.html        # 사이드바
│   │   └── search.html         # 검색
│   ├── meta/                    # 메타 정보
│   │   ├── head.html           # 헤드 태그
│   │   └── scripts.html        # 스크립트
│   └── modals/                  # 모달 컴포넌트
│       └── blog-info.html       # 블로그 정보 모달
├── _layouts/                     # 레이아웃 템플릿
│   ├── default.html             # 기본 레이아웃
│   ├── post.html                # 포스트 레이아웃
│   └── page.html                # 페이지 레이아웃
├── _pages/                       # 정적 페이지
│   ├── about.md                 # 소개 페이지
│   ├── posts.md                 # 글 목록
│   ├── projects.md              # 프로젝트 목록
│   └── tools.md                 # 도구 목록
├── _posts/                       # 블로그 포스트
├── _projects/                    # 프로젝트 상세
├── _achievements/                # 성과 기록
├── assets/                       # 정적 자원
│   ├── css/                     # CSS 파일
│   │   ├── components/         # 컴포넌트 스타일
│   │   └── pages/             # 페이지별 스타일
│   ├── js/                      # JavaScript 파일
│   │   ├── main.js            # 메인 스크립트
│   │   └── modules/           # JS 모듈
│   └── images/                  # 이미지
│       ├── posts/              # 포스트 이미지
│       ├── projects/           # 프로젝트 이미지
│       └── common/             # 공통 이미지
└── _site/                        # 생성된 사이트 (git-ignore)
```

## 설치 방법

1. Ruby와 Bundler 설치
```bash
# macOS의 경우
brew install ruby
gem install bundler
```

2. 의존성 설치
```bash
bundle install
```

3. 로컬 실행
```bash
bundle exec jekyll serve
```

http://localhost:4000 에서 사이트를 확인할 수 있습니다.

## 콘텐츠 추가 방법

### 블로그 포스트
`_posts/` 디렉토리에 다음 형식으로 새 마크다운 파일을 생성합니다:
```markdown
---
layout: post
title: 포스트 제목
date: YYYY-MM-DD
category: 카테고리-이름
---
```

### 프로젝트
`_projects/` 디렉토리에 다음 형식으로 추가합니다:
```markdown
---
layout: project
title: 프로젝트 이름
thumbnail: /assets/images/projects/썸네일.jpg
technologies: [기술1, 기술2]
---
```

### 성과
`_achievements/` 디렉토리에 다음 형식으로 생성합니다:
```markdown
---
layout: achievement
title: 성과 제목
date: YYYY-MM-DD
category: 성과-카테고리
---
```

## 주요 기능

- 반응형 디자인
- 카테고리 기반 포스트 구성
- 프로젝트 in 포트폴리오
- 성과 관리
- 검색 기능

## 제작자

**Allen Kang**
- GitHub: [@allenkang92](https://github.com/allenkang92)
