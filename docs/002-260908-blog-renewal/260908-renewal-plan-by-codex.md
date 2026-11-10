# 블로그 리뉴얼 계획

작성일: 2026-09-08 · 상태: 진행 중 (로컬 변경 누적 중, 미배포)

모드: project. 주 작업: design / documentation. 부 작업: review / ux-review.

## 목표와 범위

민트색을 중심으로 블로그 전체의 정보 구조와 시각 디자인을 새로 구성한다. 검색과 페이지네이션을 가장 먼저 설계하며, Jekyll로 글을 발행하고 React로 탐색 기능을 구현하는 구성을 우선안으로 한다.

초기 계획 단계에서는 점검과 계획 작성까지만 진행했지만, 이후 사용자가 계획에 따른 구현 지속과 누적 로그를 요청했다. 이 문서는 계획과 구현 이력을 함께 보관한다. 현재 코드 변경은 로컬 작업 트리에 있으며 배포하지 않았다. 아래 제안과 완료 로그는 구분해서 읽는다.

## 현재 진행 상태 (2026-09-16)

- 완료: 홈·글·검색·본문·시리즈·도구·소개·성과·404의 UI 개편, Jekyll 안의 React/Vite 글 탐색, 운영 검증 명령.
- 검색: URL에 검색어·분류·정렬·페이지를 반영하고 뒤로/앞으로 이동과 직접 진입을 복원한다. 한글 IME, 빈 결과, 인덱스 재시도, 10개 단위 페이지 이동을 구현했다. 화면 전환 뒤 결과 첫 항목에 키보드 포커스가 간다.
- 점진적 향상: Jekyll이 글 링크 19개를 먼저 렌더링한다. JavaScript가 꺼져 있거나 React 모듈을 불러오지 못해도 해당 정적 링크는 남는다.
- 로컬 검증: `npm run verify`가 TypeScript·React·front matter·사이트 검증기 테스트, Vite 빌드, UTF-8 Jekyll 빌드, 실제 글 메타데이터 및 생성 사이트 검사를 실행한다. 최신 실행 결과는 아래 누적 로그에 기록한다.
- 미확인: 저장소에서 실제 GitHub Pages publish source를 읽을 수 없어 배포 환경까지 확인하지 않았다. 변경은 로컬이며 배포하지 않았다.
- 다음: 자동 의미 구조 검사를 바탕으로 실제 화면의 키보드·스크린 리더 흐름과 남은 반응형 폭을 검증하고, 실제 Pages 게시 경로를 확인한다. 현재 자동 검사는 의미 있는 이름의 기본 단서만 확인하며 WCAG 적합성 판정은 아니다.

- 방문자 목표: 관심 주제의 글 찾기 → 읽기 → 기존 검색 조건과 위치로 돌아오기 → 다음 글 읽기.
- 운영자 목표: Markdown 글을 추가하면 목록·검색·시리즈에 반영되고, 발행 전에 결함을 발견하기.
- 유지 대상: 기존 글과 URL, GitHub Pages, Jekyll/Liquid, 시리즈, 성과, 도구, 댓글, RSS와 사이트맵.
- 가정: 한국어 독자의 데스크톱·모바일 이용이 주요 맥락이다. 실제 유입·기기 비율은 확인하지 않았다.
- 민감 영향: 핵심 탐색 UI, 공개 URL, 검색 데이터, 분석 이벤트, 빌드·배포 경로. 구현 시 회귀 검증이 필요하다.

## 초기 조사 결과 (2026-09-08)

아래 수치와 결함 표는 계획 수립 시점의 기준선이다. 최신 상태와 해결 여부는 위의 진행 상태 및 날짜별 누적 로그를 기준으로 본다.

로컬 기준 커밋은 `aecc45c`이다. 글은 19개이며 수학 10개, 과학 5개, 웹 3개, 일상 1개다.

생성된 HTML 38개에서 내부 링크의 대상 파일, 로컬 `img src`, fragment 대상 ID를 확인했다. 대상 파일 누락과 로컬 이미지 누락은 발견하지 않았고, 8개 페이지에서 존재하지 않는 fragment 링크 47개를 발견했다. 외부 링크, CSS 배경 이미지, PDF 내용까지 전수 검증한 결과는 아니다.

JavaScript 5개 파일의 `node --check`는 통과했다. 기본 셸 환경에서는 SCSS 변환 중 US-ASCII 오류가 났고, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`을 지정한 Jekyll 빌드는 통과했다. 저장소에 자동 테스트와 `.github` workflow 파일은 발견하지 못했다. GitHub 웹 설정에 있는 실제 배포 방식은 미확인이다.

브라우저에서는 로컬 홈·검색·글 목록과 모바일 메뉴 이동을 확인했다. 도구는 초기 화면까지만 확인했다. 토스증권 공식 홈도 시각적으로 확인했으며, 금융 데이터나 기능은 개편 범위에 포함하지 않는다.

## 결함과 개선 과제

P1은 핵심 과업을 막는 문제, P2는 사용성·운영성 개선이다. 재현된 현상과 코드상 조건부 위험을 구분한다.

| ID | 우선순위·근거 | 확인 내용 | 해결 기준 |
|---|---|---|---|
| F01 | P1 · 브라우저 재현 | `의` 검색 시 18건이라고 표시하지만 10건만 제공하고 나머지 결과로 이동할 방법이 없다. 하단 문구도 `10개 결과 중 18개 표시 중`으로 뒤바뀌었다. | 전체 결과에 접근 가능하고 전체 수·현재 범위가 일치한다. |
| F02 | P1 · 브라우저 재현 | 글 목록에서 다음을 누르면 2/2가 되지만 URL은 그대로다. 새로고침하면 1/2로 돌아간다. | 페이지 번호가 URL에 반영되고 새로고침·공유·이전/다음 이동에서 복원된다. |
| F03 | P1 · 코드상 조건부 | 카테고리 선택 시 페이지네이션을 무조건 숨기지만 목록은 10개로 자른다. 한 카테고리가 11개가 되면 전체 보기 모드로 바꾸기 전에는 다음 페이지로 갈 수 없다. 현재 최대 카테고리는 10개이므로 실제 콘텐츠로는 아직 발생하지 않았다. | 카테고리 안에서도 동일한 페이지네이션을 적용한다. 11개 이상의 fixture로 검증한다. |
| F04 | P1 · 생성 HTML 직접 확인 | 목차가 제목을 다시 slugify한다. 실제 제목 ID `21-웹-접근성이란`과 링크 `#2-1-웹-접근성이란`처럼 어긋난다. 8페이지, 47개 fragment 불일치다. | 실제 heading ID를 기준으로 목차를 만들고 링크 대상 검사를 통과한다. |
| F05 | P1 · 390px 브라우저 재현 | 모바일 메뉴를 열고 시리즈로 이동하면 다음 페이지에서도 메뉴가 열려 있고 본문이 가려진다. 열린 상태를 localStorage에 저장해 복원하는 것이 원인이다. | 메뉴 이동 후 본문을 보여 주며, 일시적인 메뉴 열림은 페이지 간 저장하지 않는다. |
| F06 | P2 · 코드 직접 확인 | 검색 데이터의 본문을 앞 500자로 제한하고 posts만 수집한다. 본문 뒤쪽의 용어와 도구·시리즈 페이지는 검색 범위에서 빠진다. | 검색 대상과 범위를 명확히 정하고 본문 검색·도구 탐색을 지원한다. |
| F07 | P2 · 코드·화면 확인 | 목록 요약으로 excerpt를 써서 일부 글은 `서론`만 표시된다. 여러 항목의 높이와 정보량이 크게 다르다. | description을 우선하고, 1~2문장으로 글의 내용을 구분할 수 있다. |
| F08 | P2 · 화면 관찰·디자인 판단 | 큰 명조체 제목과 소개가 홈 첫 화면을 차지하고, 검색은 데스크톱에서 약 223px 폭의 결과 패널에 갇힌다. | 첫 화면에서 실제 글을 확인하며 검색 결과는 본문 폭을 사용한다. |
| F09 | P2 · 코드 직접 확인 | CSS 4개 총 3,900줄이며 theme-atlas.css에 `!important`가 401개 있다. 이는 유지보수 위험 신호이며 그 자체로 성능 결함을 입증하지는 않는다. | 새 컴포넌트의 스타일 소유권을 명확히 하고 교체한 영역의 구 규칙을 함께 정리한다. |

현재 처리 상태: F01–F08은 새 화면과 검색 구조에 반영했다. F09의 광범위한 legacy CSS 정리는 별도 유지보수 작업으로 남겼다. 이 대규모 정리는 시각 변경과 한 번에 섞지 않으며, 이번 개편의 누적 로그에 남긴 범위 안에서만 스타일을 보정한다.

근거 위치:

- F01: [simple-search.js](/Users/apple/allenkang92.github.io/assets/js/simple-search.js:300), [결과 수 문구](/Users/apple/allenkang92.github.io/assets/js/simple-search.js:400)
- F02/F03: [검색·페이지 상태 모델](/Users/apple/allenkang92.github.io/frontend/posts/model.ts:1), [React 글 탐색](/Users/apple/allenkang92.github.io/frontend/posts/PostsApp.tsx:1)
- F04: [post.html](/Users/apple/allenkang92.github.io/_layouts/post.html:53)
- F05: [main.js](/Users/apple/allenkang92.github.io/assets/js/main.js:62)
- F06: [search.json](/Users/apple/allenkang92.github.io/search.json:19)
- F07/F08: [index.html](/Users/apple/allenkang92.github.io/index.html:11), [_pages/posts.html](/Users/apple/allenkang92.github.io/_pages/posts.html:40)
- F09: [theme-atlas.css](/Users/apple/allenkang92.github.io/assets/css/theme-atlas.css:1)

## 시각 디자인 방향

방향: 현재 민트 팔레트는 그대로 유지하고, 정보 위계·간격·검색 진입·목록 밀도를 토스증권 UI처럼 빠르게 훑고 선택하기 쉬운 형태로 정리한다. 특정 브랜드 컴포넌트를 복제하지 않고 블로그의 연구 노트 성격을 유지한다. [토스증권 공식 홈](https://www.tossinvest.com/)

| 요소 | 제안 |
|---|---|
| 배경·표면 | 기존 `#F5FFFB`, `#EAF8F2`, 흰색, 웜화이트를 유지한다. 넓은 컬러 면적보다 표면과 경계로 콘텐츠를 구분한다. |
| 민트 | 기존 민트 `#1F746A`, 선택 배경 `#DDF8EF`, hover `#155F57`를 유지한다. 새 색상 토큰을 추가하지 않는다. |
| 텍스트 | 현재 잉크 `#1F3430`, 본문 보조 `#4F6762`, 메타데이터 `#5D6F6B`를 유지한다. 새 색상 후보를 추가하지 않는다. |
| 글꼴 | 현재 시스템 산세리프를 제목·본문·폼·내비게이션에 사용하고, 메타데이터에는 모노스페이스를 제한적으로 사용한다. 긴 글 본문의 줄간격은 유지한다. |
| 크기·리듬 | 홈 제목은 반응형 30~46px, 일반 본문은 기존 글 읽기 규칙을 보존한다. 모바일은 제목·검색·최근 글을 먼저 배치하고 통계와 바로가기를 한 줄로 압축한다. |
| 모양 | 기존 일반 패널·버튼은 8px, 검색 컨트롤 12px, 홈 주요 카드 최대 16px로 구분한다. 최근 글은 그림자 카드 대신 분리선이 있는 행으로 보여준다. |
| 폭 | 기존 탐색 최대 920px, 본문 최대 760px 토큰을 유지한다. 모바일은 한 열로 쌓되 검색창·통계·주요 바로가기의 가로 공간을 낭비하지 않는다. |
| 브랜드 | 기존 이름과 고래 이미지는 작은 식별 요소로 사용한다. 큰 프로필 영역은 소개 페이지로 옮긴다. |

`DESIGN.md`의 색상·글꼴·홈 컴포넌트 규칙은 현재 CSS 토큰과 맞춰 개정한다. 이후 색상 변경은 별도 사용자 요청이 있을 때만 검토한다.

## 화면 구성

| 화면 | 개편 내용 |
|---|---|
| 공통 | 상단 로고, 글·시리즈·도구·소개, 검색. 성과는 소개에서 연결하고 기존 URL을 유지한다. 현재 메뉴와 키보드 포커스를 분명하게 표시한다. |
| 홈 | 짧은 소개 바로 아래 검색, 컴팩트 바로가기·통계, 실제 최신 글 1개, 최근 글 목록, 주제별 탐색 순으로 배치한다. 기존 글 수는 보조 정보로 축소한다. |
| 글·검색 `/posts/` | 넓은 검색창, 카테고리, 정렬, 적용된 조건, 결과 개수, 정돈된 글 목록, 번호형 페이지네이션. 검색과 일반 목록이 동일한 상태 모델을 사용한다. |
| 본문 | 카테고리와 제목, 작성·수정일, 짧은 요약, 목차, 본문, 이전·다음 글, 댓글. 긴 목차는 데스크톱 보조 열과 모바일 접기 방식으로 다룬다. |
| 시리즈 | 주제별 개요와 순서가 보이는 목록. 글 번호와 현재 위치를 일관되게 표시한다. |
| 도구 | 계산 입력과 결과를 먼저 배치하고 공식·설명은 이어서 제공한다. 한영 중복 라벨을 줄이고 현재 기능과 준비 중 상태를 명확히 한다. |
| 소개·성과·404 | 공통 디자인을 적용한다. 소개에서 성과로 연결하고, 404는 검색과 전체 글로 복구 경로를 제공한다. |
| 모바일 | 상단에 검색 진입점을 보이고 메뉴 안에 검색을 숨기지 않는다. 필터와 페이지 컨트롤의 터치 영역을 확보한다. |

## Jekyll + React 구성

우선안은 Jekyll + React + TypeScript + Vite다. 기존 페이지 일부에 React를 추가하는 방식은 React 공식 문서에서 안내한다. [React 기존 프로젝트 통합](https://react.dev/learn/add-react-to-an-existing-project)

| 책임 | 담당 |
|---|---|
| Markdown, 본문 HTML, 메타데이터, 실제 페이지 URL, RSS·사이트맵 | Jekyll |
| 검색어, 카테고리, 정렬, 페이지, 로딩·빈 결과·오류·재시도 UI | React 탐색 컴포넌트 |
| 정규화, 검색 점수, 정렬, 필터, 페이지 경계 계산 | React와 독립된 순수 TypeScript 함수 |
| URL 읽기·쓰기, history 복원, 데이터 로딩 | 얇은 브라우저 어댑터 |
| 공통 색·글꼴·간격 | CSS 토큰. React 내부는 범위가 한정된 스타일 |

React가 소유하는 DOM은 예전 `posts.js` 및 공통 `simple-search.js`가 동시에 수정하지 않는다. 실제 검색 UI는 `/posts/` 페이지의 React root 안에서 동작한다. 글 본문과 19개 기본 글 링크는 Jekyll HTML로 남긴다. React 오류 또는 JavaScript 비활성 상태에서도 정적 글 링크에 접근할 수 있도록 fallback을 유지하며, Jekyll HTML을 React 서버 렌더링 결과처럼 임의로 hydrate하지 않는다.

로컬 빌드: npm 의존성 설치 → Vite가 해시가 붙은 React 번들을 `assets/js/dist/`에 생성하고 동기화 스크립트가 `_data/vite_manifest.json`을 갱신 → Jekyll이 manifest를 읽어 HTML을 생성 → 타입·기능·링크 검사를 실행한다. 해시 번들과 manifest는 브랜치 기반 Pages에서도 그대로 제공할 수 있게 저장소에 포함한다. 다만 실제 Pages publish source는 확인하지 않았고 Actions workflow도 추가하지 않았다. [Vite backend integration](https://vite.dev/guide/backend-integration.html), [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

현재 추가된 영역은 `frontend/`, `scripts/`, `vite.config.mts`, `tsconfig.json`, npm 잠금 파일, `_data/vite_manifest.json`과 생성 번들이다. Jekyll은 TypeScript 원본·검증 스크립트·Vite 설정을 `_site/`에서 제외한다. Node 호환 범위는 `package.json`에 고정했고 lockfile을 사용한다. Ruby 의존성은 기존 저장소 설정을 사용한다. 배포 전 실제 Pages 설정을 확인해야 한다.

## 검색 상세 계약

- 모든 공통 검색창은 `/posts/?q=검색어`로 연결한다. 결과 페이지에서는 검색·필터·페이지가 하나의 결과 목록에 적용된다.
- 검색 대상은 발행된 글 제목, description, 본문, 카테고리 표시명, 태그다. `/series/`와 `/tools/` 설명 페이지는 검색어가 있을 때 보조 결과로 포함한다. `/posts/` 자체나 소개·성과 페이지는 검색 결과로 중복 노출하지 않는다. 페이지 설명은 front matter만 사용해 미처리 Liquid 템플릿이 검색 결과에 노출되지 않게 한다.
- 초기 검색은 NFC 정규화, 앞뒤·연속 공백 정리, 영문 대소문자 무시, 한국어 부분 문자열을 지원한다. 제목 일치에 높은 점수를 주고 본문 일치를 다음으로 둔다. 동점 순서를 안정적으로 고정한다.
- 여러 단어는 기본 AND로 처리하고, 결과가 없을 때 검색어 줄이기·필터 해제를 안내한다. 초성 검색과 오타 추정은 첫 버전 범위에 넣지 않는다.
- 입력 중 250~300ms 지연을 출발점으로 하고, 한글 IME 조합 중에는 검색을 확정하지 않는다. Enter는 즉시 확정하며 이전 예약 검색을 취소한다.
- 결과에 일치 부분 주변의 문맥을 보여 준다. 하이라이트는 텍스트 노드로 구성해 마크업을 다시 정규식 치환하지 않는다.
- 로딩, 결과 있음, 0건, 데이터 로드 실패, 재시도 상태를 분리한다. 실패 후에도 입력값을 보존한다.
- 검색 원문을 분석 이벤트에 넣지 않는다. URL에 `q`를 사용할 경우 자동 page_view의 page_location까지 포함해 실제 전송 데이터를 확인한다. 현재 GA4 전송 내용은 미검증이다.
- 데이터는 한 번 읽어 재사용하고 탐색 기능을 사용할 때 로드한다. 전체 본문 인덱스 크기와 검색 지연을 측정하며, 성능 기준을 넘으면 검색 인덱스 또는 Worker 도입을 검토한다.

## 페이지네이션과 상태 계약

- 1페이지 10개를 기본값으로 유지한다. `전체 글 보기/처음 10개만 보기`라는 별도 모드를 없애고 하나의 탐색 방식을 제공한다.
- `이전 · 1 · 2 · 3 · … · 다음`과 `전체 N건 중 A–B`를 표시한다. 모바일에서는 인접 번호 수를 줄이며 첫·끝 페이지와 현재 위치를 이해할 수 있어야 한다.
- URL 예: `/posts/?q=수학&category=mathematics_philosophy_history&sort=relevance&page=2`. 기본값은 생략할 수 있지만 역변환 결과는 동일해야 한다.
- 페이지 이동·명시적인 필터 변경은 history 항목으로 남긴다. 입력 중 갱신은 중복 history를 만들지 않는다. 입력 초안과 확정된 검색 조건을 구분한다.
- 새로고침·직접 접근·뒤로/앞으로 가기에서 조건과 페이지를 복원한다. 글을 읽고 브라우저 뒤로 가기로 돌아오면 목록 조건과 스크롤 위치를 복원한다.
- 검색어·카테고리·정렬이 바뀌면 1페이지로 이동한다. 결과 0건이면 페이지 컨트롤을 숨기고 복구 안내를 보여 준다.
- 음수·문자열 페이지, 삭제된 카테고리, 범위를 벗어난 페이지를 안전하게 정규화한다. URL과 UI가 어긋나지 않게 한다.
- 페이지 번호는 링크로 제공해 새 탭 열기·주소 복사가 가능해야 한다. 현재 페이지에 aria-current를 적용한다.
- 페이지 이동 후 결과 시작을 인지할 수 있도록 포커스·스크롤·상태 안내를 설계한다. 실시간 입력마다 포커스를 강제로 옮기지 않는다.

## 실행 순서와 단계별 완료 기준

| 단계 | 작업 | 다음 단계 기준 및 현황 |
|---|---|---|
| 1. 화면 설계 | 화면 구조와 기존 팔레트 정리 | 적용 완료. 글 검색은 320/390/1280px 브라우저에서 확인했으며, 전체 화면의 모든 폭 검증까지 완료한 것은 아니다. |
| 2. 빌드 기반 | Jekyll·Vite 연결, 데이터 계약, React 영역, 정적 fallback | 구현 완료. 생성 사이트에 정적 글 링크 19개가 유지되고 해시 번들과 manifest가 연결된다. |
| 3. 탐색 구현 | 검색·필터·정렬·페이지네이션과 URL 상태 | 구현·자동 검증 완료. 직접 URL, 브라우저 history, 한글 IME, 재시도, 10개 단위 이동 테스트가 통과했다. |
| 4. 화면 적용 | 공통 헤더, 홈·본문·시리즈·도구·소개·성과·404, 목차·모바일 메뉴 | 주요 화면 적용 완료. 생성 HTML의 언어·제목·랜드마크·이름 단서·이미지 대체 텍스트를 자동 검사한다. 실제 키보드·스크린 리더 검증은 남아 있다. |
| 5. 운영 정리 | 글 메타데이터 규칙, 스타일 정리, 자동 검사, 문서 갱신 | 실제 글 front matter·registry 및 생성 HTML 구조 검사를 추가했다. 전체 legacy CSS 정리와 콘텐츠 편집 품질 기준은 남아 있다. |
| 6. 릴리스 준비 | Pages publish source와 배포 산출물 검증·복구 절차 | 미착수. publish source를 확인하지 않았으며, 배포하지 않았다. |

React 도입과 시각 디자인은 서로 다른 검토 축이다. 단계 1에서 화면 구성을 먼저 구체화하고, 단계 3에서 기능 상태를 검증한다. 각 단계는 작은 변경 단위로 나눠 문제가 생긴 영역만 되돌릴 수 있게 한다.

## 검증 계획

- 검색 unit: 제목·본문 뒤쪽·한글 부분 문자열·혼합 언어·복수 단어·공백·HTML 특수문자·빈 문자열·동점 순서.
- 페이지 unit: 0/1/10/11/19/20/21건, 선택 카테고리 11건 이상, 마지막 페이지, 잘못된 URL, 필터 후 페이지 감소.
- 통합: 검색·카테고리·정렬·페이지 조합, URL 직렬화 왕복, popstate, 데이터 오류·재시도, React 로드 실패.
- E2E: 검색 → 2페이지 → 글 읽기 → 뒤로 가기, 새로고침·직접 URL, 한글 조합 입력, 모바일 메뉴 이동, 키보드만으로 검색과 페이지 이동.
- 정적 검사: UTF-8 Jekyll 빌드, front matter YAML·필수 필드·카테고리/시리즈 registry·순서 중복, 타입 검사, 변경 JS 문법 검사, 실제 내부 링크·목차 ID, 검색 JSON 유효성, draft 제외, URL 유지.
- 시각: 320/390/768/1280/1440px, 긴 제목·많은 페이지, 200% 텍스트 확대, 본문 표·코드·이미지, reduced motion. 기능 QA와 시각 검토를 별도로 수행한다.
- 접근성: 일반 텍스트 대비 4.5:1, 큰 글자 3:1 기준을 실제 색 조합으로 측정한다. 320 CSS px reflow를 확인한다. 프로젝트의 주요 컨트롤 목표는 44px이며 WCAG 2.5.8의 최소 24px 기준과 구분한다. [대비](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- 성능: 검색 데이터 로드 후 결과 갱신 p95 100ms 이내를 개발 검증 목표로 제안한다. 디바운스·네트워크 시간은 별도 기록하고 기기·콘텐츠 수·측정 방법을 명시한다. 현재 달성한 수치가 아니다.

## 운영 계획

Markdown과 카테고리·시리즈 registry를 편집하는 방식은 유지한다. `npm run verify:frontmatter`가 title, description, 작성일, 수정일, 카테고리 등록 여부, 선택적 시리즈 키·순서와 중복 순서를 검사한다. 대표 글은 제목 문자열 검색 대신 안정적인 식별자로 지정한다.

PR에서 빌드·데이터·링크·핵심 탐색 검사를 실행하고, 발행 후 실제 URL·모바일 화면·검색 포함 여부를 확인한다. 월간 점검은 검색 0건 비율, 실패, 읽기 진입, 깨진 링크 등 운영에 필요한 항목으로 좁힌다. 새 분석 이벤트는 검색 원문과 개인정보 전송 없이 정의한다. 관리용 CMS나 외부 검색 서비스는 이번 우선안에 추가하지 않는다.

## 결정과 재검토 조건

| 결정 | 선택 이유 | 다시 검토할 조건 |
|---|---|---|
| Jekyll 유지 + React 탐색 | 기존 글·URL을 보존하고 복잡한 화면 상태를 한곳에서 관리 | 사이트 전체가 앱으로 바뀌거나 Jekyll 유지 비용이 더 커질 때 |
| 번호형 페이지네이션 | 위치와 탐색 범위를 명시하고 URL 공유·복원 지원 | 실제 사용성 검증에서 다른 방식의 필요성이 확인될 때 |
| 현재 민트 팔레트 유지 + 흰색 표면과 명확한 위계 | 색상 선호를 유지하면서 읽기 대비와 선택 상태를 구분 | 사용자가 팔레트 변경을 요청할 때 |
| 가벼운 클라이언트 검색 | 현재 콘텐츠 규모에서 외부 운영 의존성을 줄임 | 측정한 인덱스 크기·지연 또는 검색 품질이 수용 기준을 넘을 때 |

## 부록 A. UX 점검

### 1. 사용자 과업 요약

- 첫 방문자는 글을 고르고, 재방문자는 검색으로 특정 글을 찾는다. 모바일에서 읽다가 목록으로 돌아오는 상황을 주요 검증 맥락으로 가정한다. 성공은 원하는 글과 원래 탐색 위치에 모두 도달하는 것이다.

### 2. 인지 부담 분석

- 수학·과학 내용의 어려움은 본질적인 부담이다. 별도 검색 팝업, 전체 보기 모드, 길이가 불규칙한 요약은 탐색 부담을 추가한다. 검색과 필터·페이지를 같은 화면으로 묶는 것이 개선 방향이다.

### 3. 인식 대 회상 분석

- 페이지 번호가 주소에 남지 않아 방문자가 위치를 기억해야 한다. 적용된 조건과 결과 범위를 화면에 표시하고 URL로 복원하도록 한다.

### 4. 오류 예방·오류 복구 분석

- 새로고침은 합리적인 사용자 행동인데 현재 페이지가 유실된다. 0건 검색은 검색 실패와 구분하고 필터 해제·입력 수정·재시도로 복구 경로를 제공한다.

### 5. 자동화 편향·모드 혼동 가능성

- 초기 구현은 `전체 글 보기`에서 페이지네이션을 숨겨 하나의 결과에 두 탐색 모드가 공존했다. 이번 라운드에 모드를 제거했다. 관련도순은 품질 판단이 아니라 점수 기반 순서임을 유지한다.

### 6. 접근성 점검

- 시맨틱: `npm run verify`가 생성 HTML의 `lang`, 문서 제목, H1·main 개수, 이미지 `alt` 유무, 폼·링크·버튼의 이름 단서, ID 참조를 검사한다. 자동 이름 계산이나 숨김 상태 판정은 하지 않으며, noindex·canonical·meta refresh 리디렉션은 main landmark 요구에서 제외한다. 이는 구조 검사이며 WCAG 적합성 판정이나 보조기술 전수 테스트가 아니다.
- 키보드: 검색→필터→결과→페이지 순서를 검증한다. 모바일 메뉴의 완전한 포커스 순환은 이번 점검에서 검증하지 않았다.
- 포커스: 입력 중에는 유지하고 명시적인 이동 뒤에만 적절히 복원한다. 모달을 사용하면 열기·닫기·배경 비활성화·포커스 복귀를 함께 구현한다. [WAI 모달 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- 라벨: 검색·지우기·페이지 버튼에 접근 가능한 이름을 제공하고 placeholder에만 의존하지 않는다.
- 색 독립: 선택 상태는 텍스트·밑줄·aria-current 등으로도 전달한다.
- 대비: 현재 민트 팔레트의 핵심 읽을 수 있는 색 조합을 실제 CSS 값으로 계산했다. 자세한 비율은 `DESIGN.md`에 기록했으며, 밝은 민트 강조색은 텍스트에 사용하지 않는다.
- 오류: 데이터 로딩 실패와 결과 없음은 서로 다른 문구·복구 행동으로 제공한다.

### 7. UX 법칙 점검

- Miller: 검색 조건·결과·페이지를 분리된 작은 그룹으로 묶는다.
- Hick: 첫 화면의 주 선택은 읽을 글과 주제로 좁힌다.
- Jakob: 검색창, 필터, 번호형 페이지, 브라우저 뒤로 가기를 익숙하게 만든다.
- Fitts: 모바일 페이지·닫기·초기화 컨트롤에 충분한 터치 영역을 확보한다.
- Doherty: 입력 반응과 검색 로딩을 즉시 표시하고 지연 시간을 측정한다.
- Aesthetic–Usability: 시각적으로 좋아졌어도 결과 누락·상태 유실은 별도의 실패로 판정한다.
- von Restorff: 민트 강조는 현재 선택과 주요 행동에 집중한다.
- Peak–End: 글 읽기를 마친 후 다음 글 또는 원래 목록으로 자연스럽게 이어진다.
- Tesler: URL 정규화·페이지 경계·필터 교차 처리는 시스템이 담당한다.
- Postel: 앞뒤 공백·영문 대소문자는 관대하게 입력받고 결과 범위는 일관되게 출력한다.

### 8. 윤리 리스크

- 다크 패턴: 조회 근거 없는 인기 순위나 실제보다 많은 결과 접근 가능성을 표시하지 않는다.
- 조작: 가짜 활동량·긴급성·추천 이유를 만들지 않는다.
- 프라이버시: 새 검색 UI의 분석 전송 범위를 제한한다. 기존 GA4의 실제 수집 데이터는 미확인이다.
- 자율성: 필터 초기화, 메뉴 닫기, 뒤로 가기를 지원한다. 저장하지 않아도 되는 일시적 UI 상태는 장기 보존하지 않는다.

### 9. 우선순위 개선안

- 필수: 전체 검색 결과 접근, 페이지 복원, 목차 이동, 모바일 메뉴 이동을 고친다. 읽을 글에 도달하는 핵심 과업을 보호한다.
- 권장: 검색·필터·정렬 통합, 요약 개선, 오류·빈 상태, 한글 입력 지원으로 반복 탐색의 부담을 줄인다.
- 선택: 초성·오타 검색, 다크 모드, 외부 검색 엔진은 첫 버전 이후 실제 필요와 측정 결과로 판단한다.

## 상태 점검(사실 기반)

- `F01` 검색·페이지 접근성: 정적 스크립트/시뮬레이션에서 `showPage()`는 page 버튼 생성, `page-info`, `prev/next`, `pagination` 노출 조건이 함께 계산되는 구조로 정합화됨.
  - 증거: `node --check` 통과 + `_site/posts/index.html`에서 `page-info`, `prev-page`, `next-page`, `page-links` 존재, 19개 게시물 중 기본 가시 10개/숨김 9개 확인.
- `F02` 페이지 복원: `applyListStateFromUrl()`에서 URL page/category/q를 기준으로 `normalizePage` 후 렌더가 동작함.
  - 증거: `getCurrentUrlState`, `syncUrlState`, `applyListStateFromUrl` 경로 점검 + 정규 페이지 시나리오(`0`,`-3`,`abc`,`1000`) 시뮬레이션.
- `F03` 카테고리 내부 페이지 동작: 카테고리+page 정규화 흐름(예: 10건 카테고리에서 page=2 → page=1) 검증.
  - 증거: 시뮬레이션 로그에 정합 반영 기록.
- `F04` 목차 앵커 정합: 기존 제목 ID를 보존하고, 없는 ID만 고유하게 생성하도록 보강됨.
  - 증거: 아래 2026-09-15 로그의 Jekyll 산출물 18페이지·281개 제목 점검과 모의 DOM 계약 테스트.
- `F05` 모바일 메뉴 잔상: 링크 이동 직전 닫고 다음 페이지에서 닫힌 상태로 복원하는 경로가 확인됨(실기기 검증 대기).
  - 증거: 아래 2026-09-15 모의 런타임에서 모바일 토글 → 내부 링크 이동 → 다음 페이지 초기화 시나리오 통과.
- `F06~F07`은 검색 데이터 범위·요약의 실제 브라우저 검증이 남아 있다. `F08`은 홈의 검색·대표 글·최근 목록과 `/posts/`의 검색·필터·페이지네이션을 적용했으며, 실제 브라우저 시각 QA는 미검증이다. `F09` CSS 소유권 정리는 넓은 범위에서 남아 있다.
  - 증거: 최신 로그에 변경·빌드·시각 점검 상태를 누적한다. 실제 화면과 스크린 리더 확인 전에는 홈 개선 완료로 단정하지 않는다.

### 상태 분류

- 사실(Fact): 빌드/문법/정적 산출물 검증은 반복 통과.
- 가정(Assumption): 브라우저 기반 실제 UI 회복 동선(0건 안내 액션, 터치 타깃, 포커스 회복)은 수동 확인 후 확정.
- 영향 범위: 최신 라운드는 홈·글 목록 화면, 검색 공통 include와 사이드바 조건부 노출, 페이지 탐색 JS, 디자인·계획 문서에 영향을 준다. 필터 URL 계약과 10개 단위 페이지네이션은 유지하며 민트 계열 색상값은 변경하지 않는다.
- 미검증 리스크: 오프라인/검색 인덱스 실패 폴백 체감, 모바일 실기기 키보드·포커스 흐름, 새/실험 데이터에서 카테고리>10 케이스의 실제 UI 재현.

## 부록 B. 근거 검토

### 검토 질문

- 현재 결함은 코드와 실행 결과로 확인되는가? Jekyll과 React를 결합하는 계획은 공식 지원 방식과 정합적인가?

### 근거 범위

| 범위 | 확인 자료 | 한계 |
|---|---|---|
| 제품 동작 | 로컬 소스, UTF-8 빌드, 생성 HTML 검사, 브라우저 재현 | 라이브 배포와 완전히 동일한지 미확인 |
| 기술 구성 | React·Vite·GitHub 공식 문서 | 이 저장소에 통합해 실행하지 않았음 |
| 접근성 | W3C 설명 문서와 APG | 전체 WCAG 적합성 판정이나 보조기술 전수 테스트가 아님 |

### 주장별 판정

| 주장 | 판정 | 근거 | 보정 문장 |
|---|---|---|---|
| 검색 결과 일부에 접근할 수 없다 | 강함 | 18건 중 10개만 제공하는 재현과 slice 코드 | 현재 검색창에서 11번째 이후 결과를 볼 경로가 없다. |
| Jekyll 페이지에 React를 넣을 수 있다 | 강함 | React 기존 프로젝트 통합 안내 | 부분 React 구성이 가능하며 이 저장소의 빌드 연결은 앞으로 구현한다. |
| 현재 팔레트의 텍스트 조합은 WCAG AA 대비를 만족한다 | 강함(측정한 조합 한정) | `DESIGN.md`의 토큰으로 계산한 주요 전경/배경 대비 | 새 색상 조합과 모든 페이지 상태를 추가할 때마다 재측정한다. |
| 운영 준비가 끝났다 | 근거 없음 | 계획·기초 점검만 수행 | 구현·회귀 검증·배포 설정 확인이 남아 있다. |

### 과장/불일치 리스크

- React 사용 자체가 디자인 품질이나 검색 정확도를 보장하지 않는다. 정적 링크 검사 통과가 외부 링크·전체 접근성 통과를 뜻하지 않는다.

### 보강하면 좋은 1차 출처

- 구현에 선택할 실제 라이브러리 버전 문서, GitHub Pages 현재 저장소 설정, 실제 브라우저 측정과 자동 테스트 산출물.

### 최종 방어 가능한 표현

- 현재 로컬 블로그의 핵심 탐색 결함 일부를 재현하고, Jekyll + React 기반 리뉴얼 계획을 작성했다. 사이트 구현과 배포는 수행하지 않았다.

## 작업 로그

- [2026-09-08 01:00KST] 변경 파일 상태 점검 및 미완성 항목 정리.
  - 변경 파일: `_layouts/post.html`, `_pages/posts.html`, `assets/js/main.js`, `assets/js/posts.js`, `assets/js/simple-search.js`, `assets/js/post-toc.js`, `assets/css/theme-atlas.css`, `search.json`.
  - 판단: 핵심 결함 3개(F01~F03) 대비 로직 정합성 우선 점검 필요.

- [2026-09-08 01:20KST] `posts.js` 정밀 리뷰.
  - 확인: 페이지네이션 번호 링크(`page-links`) 생성 + 범위 텍스트(전체 N건 중 A-B건) 반영 + URL/page 동기화 라우팅이 코드상 충돌 없이 동작.
  - 조치: `node --check`로 JS 6개 파일(변경 대상 포함) 문법 검증 후 이상 없음.

- [2026-09-08 01:35KST] 검색 인덱스 점검.
  - `search.json`에서 본문 `truncate` 제거 적용이 반영됨을 확인(빌드 산출물 `_site/search.json` 파싱 성공, 19건 항목, content 필드 존재/최대 길이 확인).
  - `simple-search.js`의 `MAX_VISIBLE_SEARCH_RESULTS`를 50으로 유지해 더 많은 결과 표시가 가능하도록 확인.

- [2026-09-08 01:50KST] 전체 빌드·복원성 검증.
  - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - `_site/posts/index.html`에서 페이지네이션 마크업(`#page-links`, `#page-info`)과 페이지 스크립트 주입 확인.
  - 다음 단계: 첫-마지막 페이지, 카테고리 필터 변경 후 page 링크/prev/next/URL popstate 수동 점검을 이어서 진행.

- [2026-09-08 02:10KST] 페이지네이션 정합성 보강 1차 완료.
  - `assets/js/posts.js`에서 `applyListStateFromUrl()`가 `showPage(..., { historyMode: 'replace' })`로 진입해 URL의 잘못된 페이지 번호를 정규화해 동기화되도록 수정.
  - 번호 페이지 링크 클릭 시 `showPage()` 호출 뒤 스크롤 상단 이동 + 상태 저장을 추가해 이동 흐름 일관성 보강.
  - `node --check assets/js/posts.js` + `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 재실행 통과.

- [2026-09-08 02:28KST] 페이지네이션 복원 로직 2차 보완.
  - `assets/js/posts.js`의 `getCurrentUrlState()`가 URL 카테고리 기준으로 `requestedPage`만 파싱하도록 분리되고, `applyListStateFromUrl()`/토글 경로에서 카테고리 선택 반영 후 정규화된 `page`를 계산하도록 정리됨.
  - 목표: 카테고리 변경 후 `popstate` 복원 시 이전 카테고리 글 수를 기준으로 페이지를 잘못 보정하는 버그를 제거.
  - `node --check assets/js/posts.js` + `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 재실행 통과.
- [2026-09-08 20:29:14KST] 검색 결함 1차 수정 적용. `assets/js/simple-search.js`에서 결과 표시 상한을 10개에서 `MAX_VISIBLE_SEARCH_RESULTS`(기본 50)로 확장하고, 푸터 카운트 문구를 `총 X개 중 Y개 표시`로 수정해 사용자가 실제 표시 수를 정확히 이해할 수 있게 정리했다.
- [2026-09-08 20:29:14KST] 페이지네이션 상태 결함 1차 수정 적용. `assets/js/posts.js`를 교체해 URL의 `category`/`page`를 읽어 초기 페이지를 복원하고, 이전/다음 클릭 시 URL 갱신 및 popstate 복원을 처리하도록 변경했다. 카테고리별 11개 이상 목록도 페이징이 가능하도록 분기 조건을 완화했다.
- [2026-09-08 20:32:36KST] TOC 앵커 결함 1차 수정 적용. `_layouts/post.html`에서 수동 slugify TOC 생성 블록을 제거하고, `assets/js/post-toc.js`로 실제 렌더된 `<h2>/<h3>` 요소 id 기반 TOC를 동적 생성하도록 변경해 해시 mismatch를 해소했다.
- [2026-09-08 20:32:36KST] 모바일 사이드바 상태 결함 1차 수정 적용. `assets/js/main.js`에 모바일 사이드바 링크 클릭 시 자동 접힘 이벤트를 추가해 이동 후 사이드바가 닫히도록 개선했다.
- [2026-09-08 20:33:07KST] TOC 고유 ID 생성 보강 적용. `assets/js/post-toc.js`의 fallback slug 규칙을 조정해 한글/기호 혼재 제목에서도 충돌 없는 안정 ID를 만들도록 보강했다.
- [2026-09-08 20:33:33KST] 글 목록 복귀 UX 결함 2차 수정 적용. `assets/js/posts.js`에 뒤로 가기 복원용 페이지/카테고리/스크롤 상태를 sessionStorage에 저장·복원하는 로직을 추가해 목록 이동 후 돌아왔을 때 위치를 유지하도록 처리했다.
- [2026-09-08 20:33:33KST] TOC 안정성 보강. `assets/js/post-toc.js`에서 기존 heading id를 normalize한 뒤 고유 처리하도록 변경해 기존 앵커 id 보존성과 충돌 회피를 함께 맞췄다.
- [2026-09-08 02:41KST] 템플릿 정리 + 재검증 라운드.
  - `search.json`에서 `content` 라인 들여쓰기를 정리해 가독성 정합성 보강.
  - `node --check assets/js/posts.js` + `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 재실행 통과.
  - `_site/search.json` 재파싱 결과: 19건, `content` 필드 모두 존재, 최대 본문 길이 6594자 확인.
- [2026-09-08 20:43KST] 검색 + 페이지네이션 상태 모델 1차 통합.
  - `assets/js/posts.js`를 확장해 URL 파라미터 `q`를 상태에 포함하고, 카테고리 필터와 AND 조건으로 결합한 검색 필터를 적용했다.
  - `syncUrlState`, `buildPageHref`, `getFilteredPosts`, `page` 계산 로직이 `category + query` 상태를 함께 반영하도록 정합화되어, `/posts/?q=...&category=...&page=N`에서 목록/페이지네이션이 일치하도록 개선했다.
  - 검색 입력/제출 이벤트를 감지해 `/posts` 목록도 쿼리 기준으로 재필터링하고 페이지를 1페이지로 복원하도록 연결했다.
- [2026-09-08 20:43KST] 검증 라운드(검색 결합 단계).
  - `node --check assets/js/posts.js` 통과.
  - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 변경 파일: `assets/js/posts.js` (상태 동기화 확장), `docs/002-260908-blog-renewal/260908-renewal-plan-by-codex.md` (로그 누적).
- [2026-09-08 20:44KST] `/posts/` 단일 검색 상태 모델 정합성 2차 조치.
  - `assets/js/simple-search.js`에 `/posts/` 경로에서 즉시 `initSearch()`를 종료하도록 예외를 추가해, 사이드바 검색 오버레이가 목록 페이지에서 렌더링되지 않도록 했다.
  - 목적: 검색 입력 이벤트가 `assets/js/posts.js`의 상태 모델(카테고리+query+page URL 동기화 + 페이지네이션)과 충돌하지 않도록 정합화.
  - 검증: `node --check`(simple-search/posts/main/main.js/post-toc/analytics-events) 및 `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
- [2026-09-08 20:46KST] `/posts/` 목록 검색 정합성 강화.
  - `assets/js/posts.js`에 `search.json`을 지연 로딩하는 인덱스 맵을 추가해, 목록 필터가 제목/요약뿐 아니라 `search.json`의 title·description·content·category·tags 기반으로 검색되도록 확장했다.
  - URL `q` 동기화는 유지하면서, 초기 진입 시 쿼리가 있으면 인덱스 로딩 후 목록 상태를 한 번 더 재적용해 필터 정확도를 높였고, 실패 시에는 기존 DOM 데이터셋 필터로 안전하게 폴백한다.
  - 검증: `node --check assets/js/{posts,main,simple-search,post-toc,analytics-events}.js` + `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
- [2026-09-08 20:47KST] `/posts/` 검색 경로 정합성 보강.
  - `assets/js/posts.js`의 검색 인덱스 fetch 경로를 `search-form`의 `data-search-url`을 우선 사용하도록 변경해 `baseurl` 환경에서 `/search.json` 절대 경로 의존을 제거했다.
  - `assets/js/simple-search.js`의 `/posts` 단일 검색 스킵 조건을 `endsWith('/posts')`로 완화해 경로 접미 패턴 차이를 흡수하게 개선했다.
  - 검증: `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
- [2026-09-08 20:48:02KST] 검색 인덱스 로딩 후 상태 재적용 보강 검증 항목 재점검.
  - `assets/js/posts.js`에서 `loadSearchIndex()` 완료 후 `effectiveQuery`가 있을 때 `showPage(page, { syncHistory: false })`를 한 번 더 호출해 URL/입력값 기반 필터가 `search.json` 본문 인덱스 반영으로 갱신되는 경로를 추가했다.
  - 상태 정합성 보완의 2차 조치로, 쿼리 파라미터 진입 시 이전 DOM-only 필터 결과에서 인덱스 기반 필터 결과로 넘어가도 페이지 계산이 일치하도록 정리했다.
  - 검증: `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js` + `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 재실행 통과.
- [2026-09-08 20:55:09KST] `/_site/posts/index.html` 정합성 검증 라운드.
  - 빌드 산출물에서 `/posts/` 초기 렌더 상태를 스크립트 기반으로 확인해, 목록 카드 19건 중 `visible` 10건 / `hidden` 9건이 기본 표시 정책과 일치함을 기록.
  - `/_site/posts/index.html`에 `posts.js` 페이지별 스크립트가 주입되었고(`.../assets/js/posts.js?v=...`), `data-search-url="/search.json"`와 `#search-input`/`#category-select` 요소 조합이 함께 존재해 `/posts/`에서 단일 상태 모델이 동작할 수 있음을 확인.
  - `category` 옵션은 `all`, `daily_life`, `mathematics_philosophy_history`, `science_philosophy_history`, `web_technologies` 5개가 출력되는 것을 확인.
  - 검증 커맨드: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` + 정적 산출물 텍스트 스캔(`_site/posts/index.html`).
- [2026-09-08 20:56:11KST] 검색 제출 동작 안정성 보강.
  - `assets/js/posts.js`의 `handleSearchSubmit()`에서 Enter/검색 버튼 제출 시 보류 중인 `searchInputTimer` 디바운스 타이머를 먼저 취소하도록 추가해, 입력 중 타이머가 확정 동작을 덮어쓰는 경합을 제거했다.
  - `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js` 통과.
  - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.

## 다음 라운드 실행 항목 (로그 기반)
- `카테고리 + 검색어 + page` 조합 시 URL 직접 진입(예: `/posts/?category=science_philosophy_history&q=물리&page=2`)에서 실제 필터링/페이지네이션/카운트 일치 여부를 브라우저에서 확인.
- 0건 검색(`q=없는텍스트`) 시 페이지네이션 숨김, 안내 문구, 복구 버튼/동작 일관성 확인.
- `page` 음수/`0`/`abc` 등 비정상 값 진입 시 첫 페이지로 정규화되는지 확인.
- 검색 중 Enter 제출 직후 250ms 디바운스 타이머 영향이 생기지 않는지(`handleSearchSubmit` 경합) 확인.
- `search.json` 로딩 실패 또는 오프라인 상태에서 DOM fallback 필터가 동작하는지 확인.
- 모바일 브레이크포인트에서 페이지 버튼/카테고리/검색의 터치 타겟 및 포커스 이동 동작 점검.
- [2026-09-08 21:05:22KST] 산출물 정합성 정량 점검(`python3` 스크립트).
  - `_site/posts/index.html`에서 추출한 `post-preview` 링크 수: 19건.
  - `_site/search.json` 엔트리 수: 19건.
  - 필수 필드(`title`,`url`,`content`,`description`,`category`) 누락 항목: 0건.
  - 정규화된 path 기준 교집합: 19/19 (posts ↔ search.json 1:1 매칭).
  - `search.json` 중 중복 URL: 0건.
  - 콘텐츠 길이(min/max/avg): 135 / 6594 / 3228.7.
  - 검증 커맨드:
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`
    - `python3` 기반 정합성 스크립트(게시물 링크 개수·URL 교집합·필드 누락·중복 검사).
- [2026-09-08 21:08:11KST] 페이지네이션 접근성 라벨 보강.
  - `_pages/posts.html`의 `#prev-page` / `#next-page`에 `aria-label="이전 페이지"`, `aria-label="다음 페이지"`를 추가.
  - 이유: 정적 검증에서 페이지 버튼(`<button>`) 접근성 라벨이 누락되어 있어 화면 낭독 맥락에서 버튼 목적이 모호했던 점 보완.
  - 검증: `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js` + `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 추가 점검: `_site/posts/index.html`에서 해당 라벨 반영 확인 (`prev="이전 페이지"`, `next="다음 페이지"`).
- [2026-09-08 21:10:44KST] 빌드 산출물 접근성 정적 점검(BeautifulSoup).
  - `_site/posts/index.html` 코어 노드 존재성 확인: `#toggle-posts`, `#category-select`, `#search-input`, `#posts-list`, `#pagination`, `#prev-page`, `#next-page`, `#page-links`, `#page-info` 모두 존재.
  - `#prev-page`/`#next-page`에 `aria-label` 반영 확인("이전 페이지", "다음 페이지").
  - 중복 `id` 없음, 필수 id 누락 없음, page 링크 버튼(`a.page-btn`) aria-label 미비 항목 없음(현재 정적 마크업 기준).
  - 검증 커맨드: `python3` 기반 산출물 스캔(BeautifulSoup + lxml).
- [2026-09-08 21:17:12KST] 시나리오 점검 시뮬레이션(`python3`) 추가 기록.
  - `search.json` 기준으로 카테고리/검색어/page 조합 정규화 결과를 계산해 브라우저 없이 상태 전개를 점검.
  - 확인 결과 요약:
    - `all + 쿼리없음` -> 19건, 총페이지 2, 요청 page=1은 1페이지(1~10).
    - `mathematics_philosophy_history + 쿼리없음 + page=2` -> 실측 10건(총페이지 1)이므로 page 정규화 후 1페이지로 수렴.
    - `science_philosophy_history + "물리" + page=2` -> 5건(총페이지 1)이라 page=1로 수렴.
    - `all + "없는텍스트"` -> 0건(표시범위 0-0).
    - `web_technologies + "웹" + page=3` -> 3건(총페이지 1)이라 page=1로 수렴.
  - 비정상 page값(`0`, `-3`, `abc`, `2.1`, `1000`)은 코드의 `parseInt`/정규화 규칙으로 각각 1, 1, 1, 2, 3(총페이지 상한 적용) 동작 경향에 대응함.
  - 검증 방법: `python3` 스크립트로 `search.json` 기준 필드 일치(제목/요약/본문/카테고리/태그, all-case, 공백 정규화, 소문자화) 계산.
- [2026-09-08 21:22:03KST] 카테고리 파라미터 정규화 시뮬레이션 점검.
  - `_site/posts/index.html`의 `#category-select` option 값 집합: `['all','daily_life','mathematics_philosophy_history','science_philosophy_history','web_technologies']` 확인.
  - `search.json` 카테고리 분포: 전체 19 / 수학철학·수학사 10 / 과학철학·현대물리학 5 / 웹 기술 3 / 일상 1.
  - 잘못된/누락된 `category` 파라미터는 코드 로직 기준으로 `all`로 폴백되는 시나리오를 정합성 스크립트로 확인.
- [2026-09-08 21:35:00KST] 라운드 재실행: 검색/페이지네이션 정합성 및 정적 산출물 재검증.
  - `node --check assets/js/posts.js`, `assets/js/simple-search.js`, `assets/js/main.js`, `assets/js/post-toc.js`, `assets/js/analytics-events.js` 모두 통과.
  - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - `python3` 시뮬레이션으로 `category + query + page` 조합 재점검:
    - `all`, `page=1`, `q=''` → 총 19건, 정규화 page 1, 표시 범위 1-10
    - `mathematics_philosophy_history`, `page=2`, `q=''` → 총 10건, 정규화 page 1, 표시 범위 1-10
    - `science_philosophy_history`, `page=2`, `q='물리'` → 총 5건, 정규화 page 1, 표시 범위 1-5
    - `web_technologies`, `page=3`, `q='웹'` → 총 3건, 정규화 page 1, 표시 범위 1-3
    - `q='없는텍스트'` → 총 0건, 표시 범위 0-0, 페이지는 1로 고정
    - `page=0`/`-3`/`abc`는 1로 정규화, `page=2.1`/`1000`는 상한 내에서 2로 정규화.
  - `_site/posts/index.html` 정적 점검:
    - 필수 id(`toggle-posts`,`category-select`,`search-input`,`posts-list`,`pagination`,`page-links`,`page-info`,`prev-page`,`next-page`,`posts-count`) 존재
    - 중복 id 없음, `a.page-btn` 모두 aria-label 존재, `posts.js` 주입 여부 `true`
    - 검색 폼은 id가 아닌 `.search-form` 클래스 존재(`data-search-url`은 `/search.json`)
  - 0건 검색/탐색 실패/모바일 포커스 동선은 브라우저 기반 확인이 남아 있어 추후 UI 세션에서 이어서 점검 필요.
- [2026-09-08 20:54:14KST] 시나리오 감산/분기 점검 확장(코드 경로 상 검증).
  - `_site/search.json` 기준으로 `카테고리/검색어/요청 page` 조합을 재계산해 `posts.js` 정규화 규칙과 대조.
  - 결과:
    - `category=all, q="" , page=1` → `total=19, page=1, range=1-10, 텍스트="전체 19개 글"`
    - `category=all, q="물리", page=1` → `total=10, page=1, range=1-10, 텍스트=""물리" 검색 결과 10개"`
    - `category=all, q="없는텍스트", page=1` → `total=0, page=1, range=0-0, 텍스트="표시할 글이 없습니다"`
    - `category=web_technologies, q="웹", page=3` → `total=3, page=1, range=1-3`
    - `category=mathematics_philosophy_history, q="", page=2` → `total=10, page=1, range=1-10`
    - `page=-3/0/abc`는 `1`로 정규화, `page=2.1/1000`는 상한 반영.
  - 분기 점검으로 `선택한 카테고리 10개 글`, `science...에서 "물리" 검색 결과 5개` 등 문구 계산 경로가 코드 스펙(카테고리+쿼리 라벨링 + 총개수/범위 규칙)과 일치함을 확인.
  - 검증 항목은 정적/시뮬레이션 기반이며, 네트워크 단절·실 디바이스 터치/포커스는 아직 브라우저 세션 대기 항목으로 남겨 둠.
- [2026-09-08 20:54:14KST] 2차 정적 점검 반영 후 상태 점검 요약 작성.
  - 페이지·검색 정합성은 코드 시뮬레이션 상 `normalizePage`/카테고리 폴백이 일치함을 재확인.
  - `/_site/posts/index.html`에서 검색폼(`#search-input`,`.search-form`), 카테고리(`category-select`), 페이지 관련 노드(`page-info`,`page-links`,`prev-page`,`next-page`) 존재와 `posts.js` 주입, 기본 가시/비가시 카드 카운트를 모두 확인.
  - 미확인 항목은 브라우저 기반 UX로 명시: 0건 상태 복구 버튼/메시지, 네트워크 실패 폴백, 모바일 터치 타겟·포커스 동선.
- [2026-09-08 20:55:56KST] 0건 상태 복구 동선 구현(사전 단계) 반영.
  - `_pages/posts.html`에 0건 전용 상태 영역(`#posts-empty-state`)과 초기화 버튼(`#clear-post-filters`)을 추가.
  - `assets/js/posts.js`에 무결성 경량 분기 추가:
    - 필터 후 결과 수가 0일 때 상태 메시지 노출 (`updateEmptyState`).
    - 결과 0개시 `페이지네이션` 유지 로직은 기존대로 두되 `pagination` 숨김 + 상태 메시지를 통한 복구 안내.
    - 초기화 버튼 클릭 시 `search input` 비움 + 카테고리 `all` 복귀 + 페이지/URL 정합 상태로 즉시 재표시.
  - `assets/css/theme-atlas.css`에 `.posts-empty-state`, `.inline-action-btn` 스타일 추가.
  - 검증: `node --check assets/js/posts.js` 통과, `bundle exec jekyll build` 통과, `_site/posts/index.html`에서 `#posts-empty-state`/`#clear-post-filters` 존재 확인.
- [2026-09-08 20:56:36KST] 압축 전/후 상태 점검 재확인 라운드(정적 산출물 기준).
  - `_site/posts/index.html`에서 `id="posts-empty-state"`, `id="clear-post-filters"`, `id="posts-count"`, `id="pagination"`, `id="page-info"`, `id="page-links"` 요소 존재를 재확인.
  - 검색 폼 경로 문구/aria 속성은 유지되고, 이전/다음 버튼 aria-label도 `이전 페이지`/`다음 페이지`로 반영됨.
  - `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js` 통과, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 미확인 항목은 브라우저 기반 실제 동작(실시간 검색 빈결과 복구 노출, 오프라인 fallback, 모바일 터치·포커스) 그대로 남아 있음.
- [2026-09-08 20:57:52KST] 0건 상태 UX 디테일 수정 반영.
  - `_pages/posts.html`의 0건 안내 블록을 텍스트와 액션 버튼이 분리된 구조로 변경해 JS가 동적으로 안내 문구를 갱신해도 버튼이 사라지지 않도록 함(`posts-empty-message` 분리).
  - `assets/js/posts.js`의 `updateEmptyState()`가 `emptyState.textContent`를 직접 쓰지 않고 메시지 노드(`posts-empty-message`)만 갱신하도록 수정.
  - `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js` 통과, `bundle exec jekyll build` 통과.
  - `_site/posts/index.html`에서 `#posts-empty-message` 존재와 `필터 초기화` 버튼 공존을 재확인.
- [2026-09-08 20:59:06KST] 체크리스트 시뮬레이션(정적 URL/필터 상태) 재실행.
  - `_site/posts/index.html`의 카드 `data-categories`와 `_site/search.json`을 정규화해서 결합한 뒤, 브라우저 없이 필터 케이스를 재계산.
  - `science_philosophy_history + "물리"` → 총 5건, 정규화 페이지 1, 범위 1-5
  - `web_technologies + "웹" + page=3` → 총 3건, 정규화 페이지 1, 범위 1-3
  - `all + "없는텍스트"` → 총 0건, 정규화 페이지 1, 범위 0-0
  - `all + page=abc/0/1000` → 각각 1, 1, 2로 정규화되어 예상치와 일치.
  - `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js` + `bundle exec jekyll build` 재실행 통과.

- [2026-09-08 21:00:43KST] 브라우저 미실행 재점검 라운드(정적 시뮬레이션 보강).
  - 추가 시나리오 재확인 결과:
    - `all + "물리" + page=2` → 총 10건, 정규화 `page=1`, 표시 `1-10`
    - `all + "없는텍스트"` → 총 0건, 정규화 `page=1`, 표시 `0-0`
    - `science_philosophy_history + "물리" + page=2` → 총 5건, 정규화 `page=1`, 표시 `1-5`
    - `web_technologies + "웹" + page=3` → 총 3건, 정규화 `page=1`, 표시 `1-3`
    - `all + page=0/-3/2.1/1000` → 정규화 각각 `1/1/2/2`
  - `_site/posts/index.html` 핵심 노드 존재성 재확인:
    - `#posts-empty-message`, `#clear-post-filters`, `#page-links`, `#prev-page`, `#next-page`, `#search-form[data-search-url]`, `#posts-list` 모두 존재.
  - 페이지 링크(`a.page-btn`) 동적 생성은 초기 정적 마크업에서 0개로 확인되어, 실제 런타임 상태에서는 스크립트 실행 후 페이지 수를 다시 확인해야 함.
  - 남은 미검증 항목은 브라우저 실행 기반으로 유지: 0건 안내/복구 버튼 실제 노출, `search.json` 실패 폴백, 모바일 390px 터치·포커스 동선.
  - 검증 커맨드: `bundle exec jekyll build`, `node --check`(posts/simple-search/main/post-toc/analytics-events), `_site` 시나리오 Python 스크립트.

- [2026-09-09 21:00:00KST] fallback 품질 보강 + 환경 제약 재확인.
  - `/posts/` 카드 항목에 `data-tags`와 `data-content`를 추가해 `search.json` 로딩 실패 시 DOM fallback 검색 범위를 넓히도록 구현.
  - `assets/js/posts.js`의 `getFilteredPosts()` fallback 경로에서 `searchIndex` 미적재 상태일 때 `post.dataset.tags`, `post.dataset.content`를 검색 텍스트 조합에 반영하도록 보강.
  - `node --check assets/js/posts.js`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 재실행 통과.
  - 빌드 산출물 `_site/posts/index.html`에서 각 `.post-preview`가 `data-content`/`data-tags`를 갖는지 확인(19건).
  - 브라우저 점검(로컬 서버 기동/실행)은 여전히 미지원: `python3 -m http.server` 실행이 환경 제한으로 `Operation not permitted`.
  - `search.json` 실패 폴백 자체는 코드 경로상 보강되었으나, 실 브라우저 런타임에서 0건 상태 메시지/복구 버튼 동작·모바일 포커스는 아직 미검증.

- [2026-09-09 22:10:30KST] 검색 입력 IME/터치 UX 보강 + 문법·빌드 재검증.
  - `assets/js/posts.js`에서 검색 입력 처리에 composition 추적을 넣어 IME 조합 중 불필요한 자동 재필터링을 막고, 필터 초기화 동작 후 검색창으로 포커스를 돌려 키보드 사용자의 연속 작업을 유지하도록 보강.
  - `getSearchIndexDataByPost()`에서 URL 디코딩 예외를 안전하게 처리해 검색 인덱스 매칭 경로가 깨지지 않도록 가드 라인을 추가.
  - 검증: `node --check assets/js/{posts,simple-search,main,post-toc}.js`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 정적 산출물 확인: `/_site/posts/index.html`에서 0건 안내 영역(`#posts-empty-state`), `#posts-empty-message`, 복구 버튼(`#clear-post-filters`), `aria-label`가 반영된 `prev/next` 존재 확인.
  - 브라우저 런타임(실제 화면 상호작용) 점검은 계속 보류: 로컬 서버 바인딩 제한(`Operation not permitted`)으로 `/posts/?q=...` 재진입, 모바일 390px 터치·포커스, 검색 실패 폴백 실제 노출은 수동 세션이 필요.

- [2026-09-09 23:24:00KST] 390px 모바일 조작성 보강 라운드.
  - `/assets/css/theme-atlas.css`에 `@media (max-width: 390px)` 조정 추가:
    - `게시 목록 컨트롤` 전체(`.posts-controls`, `.posts-info`, `.toggle-btn`)를 폭 100%로 늘리고 토글/필터/버튼의 터치 타겟 높이를 46px로 상향.
    - 페이지네이션(`.pagination`, `#page-info`, `.page-links`, `.page-btn`)에서 너비·줄바꿈·정렬을 정비해 390px에서도 이전/다음/번호 버튼 동작이 끊기지 않게 조정.
    - 0건 안내 블록 여백/행간 정리, `search-input`/카테고리 셀렉트/액션 버튼 폰트 크기를 16px로 고정해 iOS 확대를 방지.
  - 검증: `node --check assets/js/{posts,simple-search,main,post-toc}.js`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 산출물 검사: `_site/posts/index.html`에서 목록/페이지네이션 핵심 노드 존재 상태는 변경 전 기준을 그대로 유지.
  - 아직 미검증: 브라우저 실제 터치·포커스 동선, `search.json` 실패 폴백 가시성.

- [2026-09-10 00:00:00KST] 정적 정합성 검사 보강.
  - `node --check` + `bundle exec jekyll build` 재실행으로 문법/산출물 파이프라인을 다시 통과 확인.
  - 정적 HTML/JSON 교차검증 스크립트로 다음 항목을 확인:
    - `/site/posts/index.html` 핵심 id 존재성: `toggle-posts`, `category-select`, `search-input`, `posts-list`, `pagination`, `page-links`, `page-info`, `prev-page`, `next-page`, `posts-count`, `posts-empty-state`, `posts-empty-message`, `clear-post-filters`.
    - 중복 id 없음, 390px 미디어쿼리 존재(`@media (max-width: 390px)`), `main.js`의 `collapseSidebarOnNavigation` 경로 존재(모바일 이동 시 사이드바 닫힘 코드 경로 보유).
    - `_site/search.json` 경로 집합과 `_site/posts/index.html`의 `.post-preview` href 집합 정규화 일치(19/19).
  - 시나리오 정규화 시뮬레이션으로 URL/필터 케이스 점검:
    - `all + q='' + page=1`: 총19건, 총페이지2, 정규 page=1, 표시 1-10
    - `all + q='물리' + page=2`: 총10건, 총페이지1, 정규 page=1, 표시 1-10
    - `science_philosophy_history + q='물리' + page=2`: 총5건, 총페이지1, 정규 page=1, 표시 1-5
    - `web_technologies + q='웹' + page=3`: 총3건, 총페이지1, 정규 page=1, 표시 1-3
    - `q='없는텍스트'`: 총0건, 표시 0-0
    - `page=0/-3/abc` 정규화→1, `page=2.1/1000` 정규화→2
  - 여전히 미검증: 실제 브라우저에서의 모바일 터치·포커스 이동 체감, `search.json` 네트워크 실패 시 가시성(오프라인 fallback).

- [2026-09-09 11:56:00KST] 재확인 라운드(컴팩트 후 흐름 점검).
  - 변경 트리 확인 결과: `_layouts/post.html`, `_pages/posts.html`, `assets/css/theme-atlas.css`, `assets/js/main.js`, `assets/js/posts.js`, `assets/js/simple-search.js`, `search.json`가 변경 상태. `assets/js/post-toc.js`가 untracked 상태로 추가(TOC anchor 정합성 보강 목적).
  - 근거: `git status --short` + `git diff --name-only`로 확인.
  - 정적 정합성 재검증 반복 실행:
    - `node --check assets/js/{posts,simple-search,main,post-toc,analytics-events}.js` 통과
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과
    - `_site/posts/index.html` 핵심 id(`toggle-posts`, `category-select`, `search-input`, `posts-list`, `pagination`, `page-links`, `page-info`, `prev-page`, `next-page`, `posts-count`, `posts-empty-state`, `posts-empty-message`, `clear-post-filters`) 존재성 재확인
    - `@media (max-width: 390px)` 존재성 확인
  - 정규화 시나리오 정적 재시뮬레이션 재점검: (all,q=물리,page=2)/(science_philosophy_history,q=물리,page=2)/(web_technologies,q=웹,page=3)/(없는텍스트)/(page=0/-3/abc/1000) 모두 기존 로그와 동일 경로로 정규화/표시 범위 정합.
  - 미검증 리스크: 390px 실제 터치·포커스 체감, `search.json` 오프라인/네트워크 실패 상태의 브라우저 UI, 0건 메시지/복구 동선의 실제 렌더링은 실기기/브라우저 수동 점검 대기.


- [2026-09-09 12:01:00KST] 정적 상태 시뮬레이션 재점검 라운드.
  - `python3` 정규화 시뮬레이션으로 핵심 URL/필터 시나리오를 재계산:
    - `(all, q="", page=1)` → 총19건, totalPages=2, page=1, range=1-10
    - `(all, q="물리", page=2)` → 총10건, totalPages=1, page=1, range=1-10
    - `(all, q="없는텍스트", page=1)` → 총0건, totalPages=1, page=1, range=0-0
    - `(science_philosophy_history, q="물리", page=2)` → 총5건, totalPages=1, page=1, range=1-5
    - `(web_technologies, q="웹", page=3)` → 총3건, totalPages=1, page=1, range=1-3
    - `(all, q="", page=0/-3/abc)` → 모두 page=1로 정규화
    - `(all, q="", page=1000)` → page=2
    - `(mathematics_philosophy_history, q="", page=2)` → page=1
    - `(all, q="물리", page="2.1")` → page=1
  - 산출물 정합성 체크:
    - `_site/posts/index.html` 핵심 id 누락 없음(`posts-search-status` 포함)
    - `post-preview` 19개 모두 `data-title / data-description / data-content / data-tags / data-categories` 보유
  - 검증: 정적 시뮬레이션은 계속 통과, 브라우저 수동 점검은 여전한 환경 제약으로 미수행.

- [2026-09-09 11:58:00KST] 오프라인 폴백 가시성 보강 라운드.
  - `_pages/posts.html`에 `#posts-search-status` 상태 라벨 영역 추가. 검색어 입력 상태에서 `search.json` 로드 실패를 감지하면 `posts.js`가 오프라인/네트워크 제한 알림을 표시하도록 보강.
  - `assets/js/posts.js`에 `searchIndexLoadState`(loaded/failed) 추적을 추가해 `search.json` 실패 시 DOM fallback(제목/요약/태그/data-content) 사용을 유지하고 상태 안내 문구를 노출하도록 분기 강화.
  - `assets/css/theme-atlas.css`에 `.posts-search-status` 스타일 추가(보조 텍스트 크기/간격).
  - 검증: `node --check assets/js/{posts,simple-search,main,post-toc}.js` 통과.
  - 검증: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 산출물 확인: `_site/posts/index.html`에서 `#posts-search-status` 존재, `posts.js` 주입, `data-title/description/content/tags` 유지 확인.
  - 미검증: 브라우저에서 실제 네트워크 차단/재시도 동작의 실체감은 여전히 환경 제한으로 대기.

- [2026-09-09 13:20:00KST] 전역 검색 인덱스 확장 라운드.
  - `search.json` 생성 로직에 `_pages` 항목을 추가해 시리즈/도구/소개 등 페이지도 전역 검색 대상으로 반영되도록 확장.
  - `type: post|page`를 추가해 검색 결과에서 콘텐츠 유형 표시가 가능하게 조치.
  - `simple-search.js`에서 결과 메타의 안정성을 높이기 위해 정렬 기준을 `점수`→`날짜`→`제목` 순으로 보정하고, 누락 날짜 항목의 에러 가능성을 제거.
  - 결과 메타에서 타입 라벨(포스트/페이지)을 렌더링하도록 보강하고, 페이지 타입 표기용 스타일을 `.category-chip`로 병행 적용.
  - `search.json` 반영 수치: 전체 26개, `type=page`는 7개(`about`, `tools`, 시리즈 페이지 포함).
  - 검증: `bundle exec jekyll build` 통과, `_site/search.json` JSON 파싱 및 타입 카운트 확인.

- [2026-09-09 13:23:00KST] 목록 요약 개선 라운드.
  - `/posts/` 카드 요약 텍스트를 60자→120자로 상향해 동일 내용이 반복되거나 '서론' 단편 노출되는 빈도를 줄임.
  - `data-description`도 요약을 120자로 늘려 로컬 fallback 검색에서 더 많은 문맥어를 확보.
  - 검증: 빌드 통과 + `_site/posts/index.html`에 변경된 템플릿 산출 확인.

- [2026-09-09 23:30:00KST] 홈/검색 UI 정렬 보강 라운드.
  - `assets/css/theme-atlas.css`에 홈 히어로 타이포와 검색 결과 패널 정렬 규칙을 보강했다.
    - `search-widget`, `search-form`, `search-container`, `search-results`에 폭/박스모델 규칙을 추가해 사이드바 검색 결과가 부모 폭의 100%를 차지하도록 정렬성 정합성을 맞췄다.
    - 검색 결과 항목 타이틀 링크(`.search-result-title a`)에 터치 대상 최소 높이를 부여해 키보드/포커스 동작을 보강했다.
    - 홈 상단 `h1`를 `clamp(1.9rem, 4vw, 2.9rem)`로 축소하고 폰트를 `var(--atlas-sans)`로 바꿔 첫 화면 점유를 낮추고 실사용 진입성을 높였다.
    - 텍스트 라인 하이트/간격을 소폭 조정해 가독성 여유를 키웠다.
  - 검증: `node --check assets/js/{posts,simple-search,main,post-toc}.js`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 산출물 반영 검증: `_site/index.html`, `_site/posts/index.html` 템플릿 재생성.
  - 미검증: 데스크탑 실제 화면에서 검색 결과 폭 체감(223px 고착) 및 0건/오프라인 폴백 메시지의 실기기 렌더는 여전히 수동 세션 필요.

  ## 브라우저 점검 체크리스트(다음 라운드)

1. `/posts/?q=물리&page=2`에서 목록 갱신 후 URL page 표시가 `1`인지, 페이지 안내 텍스트(`전체/검색어/카테고리`)와 실제 카드 수치가 일치하는지.
   - 정적 시뮬레이션은 완료했으나 실제 브라우저 렌더 검증은 필요.
2. `q=없는텍스트` 진입 시 0건 메시지/복구 액션이 보이는지 + `페이지 1/1` 또는 페이지 UI 숨김 상태 확인.
3. `page=abc`, `page=0`, `page=1000` 직접 입력 뒤 새로고침 시 정규화 동작 확인.
4. `search.json` 로딩 실패(일시 네트워크 차단) 시 DOM fallback(기존 data-* 검색)이 유지되는지.
   - 코드 경로 상 fallback는 보강되어 정적 검증 완료(`data-content`/`data-tags` 반영).
   - 런타임 브라우저 검증은 환경 제약으로 미수행.
5. 모바일 `390px` 기준 `prev/next`, 페이지 번호 링크, 카테고리 select, 검색 실행 동작과 포커스 이동이 끊기지 않는지.
   - 2026-09-09 23:24:00KST에 CSS 보강(390px 미디어쿼리) 완료로 버튼 너비·간격·폼 폰트크기를 선행 최적화했으나, 실제 인터랙션 검증은 브라우저 세션 대기.
6. `category-select='web_technologies' + q='웹' + page=3` URL 직진 진입에서 정규화 결과(page=1), 현재 페이지와 결과 텍스트 일치 점검.
   - 정적 시뮬레이션은 완료했으나 페이지 UI/URL 렌더 최종 동작은 브라우저 확인 필요.

- [2026-09-13 00:00:00KST] 정적 정합성 라운드 재실행(재시작형).
  - `bundle exec jekyll build` + `node --check`(`posts.js/simple-search.js/main.js/post-toc.js`)를 재실행해 배포 파이프라인의 정적 안정성을 다시 확인했다.
  - `_site/posts/index.html` 핵심 노드 존재성 재점검:
    - `#toggle-posts`, `#category-select`, `#search-input`, `#posts-list`, `#pagination`, `#page-links`, `#page-info`, `#prev-page`, `#next-page`, `#posts-count`, `#posts-empty-state`, `#posts-empty-message`, `#clear-post-filters`, `#posts-search-status` 모두 존재.
    - 초기 정적 렌더링에서 `#page-links`는 0개(런타임 렌더링 전 상태)로 확인됨. 런타임 렌더는 `posts.js`가 조건이 맞는 시점에 생성.
    - `search-form`의 `data-search-url` 값은 `/search.json`으로 확인.
  - `/posts/` 정규화 시뮬레이션 스크립트를 `page='abc'`, `page='2.1'`, `page='-3'`, `page='0.5'`, `page='1000'`까지 포함해 재구동해 시나리오 충돌 없이 종료되도록 보강 후 통과:
    - `all + q='' + page='1'` → 총19건, 총페이지2, 정규 page=1, 표시 1-10
    - `all + q='물리' + page='2'` → 총10건, 총페이지1, 정규 page=1, 표시 1-10
    - `all + q='물리' + page='abc'` → 총10건, 총페이지1, 정규 page=1, 표시 1-10
    - `science_philosophy_history + q='물리' + page='2.1'` → 총5건, 총페이지1, 정규 page=1, 표시 1-5
    - `web_technologies + q='웹' + page='3'` → 총3건, 총페이지1, 정규 page=1, 표시 1-3
    - `all + q='없는텍스트' + page='1'` → 총0건, 총페이지1, 정규 page=1, 표시 0-0
    - `mathematics_philosophy_history + q='' + page='0'` → 총10건, 총페이지1, 정규 page=1, 표시 1-10
    - `all + q='' + page='-3'` → 총19건, 총페이지2, 정규 page=1, 표시 1-10
    - `all + q='' + page='1000'` → 총19건, 총페이지2, 정규 page=2, 표시 11-19
    - `all + q='' + page='0.5'` → 총19건, 총페이지2, 정규 page=1, 표시 1-10
  - 보완 확인:
    - 정규화 스크립트는 `search.json` 엔트리(현재 26개 중 pages 포함) 기준 계산에서 `post` 렌더 대상을 19개로 분리해 집계해 과거 예외 종료 이슈를 해소.
    - `searchIndex` URL 매핑은 posts 대상 19개와 정합되며, `search.json` 자체는 pages를 포함해 26개를 유지해 전역 검색 용도와 분리해 관리 중.
  - 미검증은 계속 동일:
    - 실 브라우저에서 `q=없는텍스트` 0건 안내 텍스트/복구 버튼/페이지 UI 노출 상태.
    - 실제 네트워크 단절에서 `posts-search-status` fallback 메시지 노출 체감.
    - 390px 모바일 터치·포커스 체감(코드로는 패턴은 정돈되었으나, 실기기 확인 보류).

- [2026-09-13 00:10:00KST] 로컬 런타임 점검 보완 시도.
  - `ruby -run -e httpd _site -p 4173` 실행을 시도했으나 `zsh:1: nice(5) failed: operation not permitted`로 서버 프로세스가 기동되지 못해 정적 페이지를 브라우저 없이 자동 조회할 수 없음.
  - 기존 제약(파이썬 http.server 동일)은 유지되어, 브라우저 기반 상호작용/터치·포커스 검증은 다음 오프라인 런타임 환경에서 계속 보류.

- [2026-09-13 00:20:00KST] `search.json` 템플릿 정합성 보강.
  - 근거 점검에서 `_site/search.json`의 `page` 항목 7건 모두 `date`가 빈 문자열(`""`)로 남아 있어 정렬/표시 일관성에 불리한 상태였음을 확인.
  - `search.json` 템플릿의 페이지 항목 `date` 기본값을 `{{ page.date | default: site.time | date: "%Y-%m-%d" }}`로 변경해, 페이지도 날짜 필드가 항상 채워지도록 보강.
  - 검증 실행:
    - `bundle exec jekyll build`
    - `node --check assets/js/{posts,simple-search,main,post-toc}.js`
    - `python3`로 `_site/search.json` 필수 필드(`title`, `url`, `date`) 존재성 스캔
  - 결과:
    - `_site/search.json` 항목 총 26개(`post` 19 / `page` 7) 유지.
    - `missing required`(title/url/date): 0건.
  - 남은 미검증은 동일:
    - 실 브라우저에서 `/posts/?q=없는텍스트` 0건 상태 문구/복구 버튼 노출,
    - 실 네트워크 상태에서 fallback 안내, 390px 터치/포커스 동선.

- [2026-09-13 02:10:00KST] 카테고리 선택자 중복 회귀 수정 + 정적 재점검.
  - `/_site/posts/index.html`에서 `#category-select`가 사이드바에 이미 존재함을 확인했고, 페이지 내부 중복 추가 시도는 ID 중복을 일으켜 제거함.
  - `_pages/posts.html`에서 추가했던 새 `category-select` 마크업과 `.theme-atlas.css`의 신규 `.category-select` 스타일을 롤백하고, 기존 사이드바 필터를 단일 소스로 유지.
  - 검증 실행:
    - `node --check assets/js/{posts,simple-search,main,post-toc}.js`
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`
    - 파싱 스크립트로 `_site/posts/index.html` ID 존재성/중복성, category-select 노출, `post-preview` 속성 존재성, `search.json` 필수 필드 재검증
  - 결과:
    - 필수 id 누락 없음(`required id duplicates = []`).
    - `#category-select`는 단일 블록으로 존재, `option` 5개(`all` + 4개 카테고리) 정상 출력.
    - `post-preview` 19개 모두 `data-title / data-description / data-content / data-tags / data-categories` 유지.
    - `_site/search.json` 총 26개, `title/url/date` 누락 0건, type 분포 `post:19 / page:7` 유지.
    - 정적 시나리오에서 필터/페이지 정규화는 이전 기록과 일치: `all+q='' + page=1 -> 1-10`, `all+q='물리'+page=2 -> page 1`, `science...+q='물리'+page=2 -> 1-5`, `web_technologies+q='웹'+page=3 -> 1-3`, `page=1000 -> 11-19`.
  - 미검증 영역은 기존과 동일: 브라우저 기반 0건 안내/복구 동선과 모바일 터치·포커스 체감, 네트워크 단절 fallback는 여전하게 수동 검증 대기.

- [2026-09-13 02:30:00KST] 정적 전역·페이지 레벨 정합성 재점검 라운드.
  - `_site` 전체 HTML 38건에서 ID 중복 검사 실행(`id` 중복이 있는 파일 수 0).
  - `/posts/` 정적 산출물 점검:
    - 필수 노드 누락 없음: `#toggle-posts`, `#category-select`, `#posts-list`, `#pagination`, `#page-links`, `#page-info`, `#prev-page`, `#next-page`, `#posts-count`, `#posts-empty-state`, `#posts-empty-message`, `#clear-post-filters`, `#posts-search-status`.
    - `#category-select` 단일 블록(5개 옵션: `all + 4개 카테고리)`, 내부 중복 없음.
    - `.post-preview` 19개, `data-title / data-description / data-content / data-tags / data-categories`가 모두 19개 일치.
  - 시나리오 재확인(정적 텍스트 검색 경로):
    - `"의"` 키워드 매칭 건수 18건(`search-pageSize=10` 가정 시 표시 범위는 page=2에서 `11-18`).
    - `web_technologies + "웹"` 3건, `science_philosophy_history + "물리"` 5건, `없는텍스트` 0건.
  - `node --check` / 빌드 결과는 직전 라운드에서 통과 상태 유지.
  - 미검증은 동일: 브라우저 기반 실제 상호작용(0건 안내 텍스트/복구, 네트워크 실패 폴백 알림 표시, 모바일 390px 터치/포커스) 검증.

- [2026-09-13 02:45:00KST] 런타임 점검 경로 재시도.
  - 의도: 브라우저/네트워크 동작 기반 `/posts/?q=...` 계열 동작을 로컬 정적 서버로 확인.
  - 실행 방법: Python `http.server` 유사 코드를 Python 내장 `ThreadingHTTPServer`로 직접 기동해 `http://127.0.0.1:45678`에서 정적 라우트만 조회.
  - 결과: `PermissionError: [Errno 1] Operation not permitted`로 소켓 바인딩이 거부되어 네트워크 서버 기동이 되지 않음.
  - 영향: 브라우저 기반 실제 상호작용 재현(0건 안내/복구, 네트워크 실패 fallback 문구, 모바일 터치 체감)은 여전히 실행 환경 제약으로 미검증.
  - 정적 검증 연속 근거:
    - Jekyll 빌드/JS 문법 체크는 통과 유지.
    - 전체 `_site` HTML 중 ID 중복 없음.
    - `/posts/` 핵심 요구 노드/데이터 속성 유효성은 이전 라운드와 동일하게 정합.

- [2026-09-13 02:55:00KST] TOC 정합성 정적 검증 라운드.
  - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 후 Python 스크립트로 `_site`의 글 상세 페이지(현재 19건)에서 목차 관련 정합성 검증.
  - 검증 대상: `h2/h3` id 중복, `table-of-contents` 존재 시 toc-list 유무, `id` 목록과 잠정 toc 링크 일치성.
  - 결과:
    - `pages_total: 19`
    - `pages_with_duplicates: []`
    - `empty_toc_ids: []` (`.table-of-contents .toc-list` 누락 없음)
    - `no_heading_pages: []`
    - `unresolved_toc_links: []`
  - 해석: `_layouts/post.html`의 TOC placeholder + `assets/js/post-toc.js` 결합은 정적 기준에서 `h2/h3` 고유 ID 정합성 및 TOC 앵커 미스매치 위험을 낮춘 상태로 확인.
  - 미검증은 동일: 0건 안내/복구, search.json 실패 fallback, 모바일 터치·포커스 체감은 여전히 브라우저 런타임 의존.

- [2026-09-13 03:20:00KST] 검색/게시물 매핑 정적 정합성 재점검.
  - `bundle exec jekyll build` 후 Python 스크립트로 `_site/search.json`의 `post` 항목(19건)과 `/posts/index.html` 카드(`.post-preview`, 19건) 매핑, 필수 필드, 검색어 매칭을 재확인했다.
  - 검증 결과:
    - 카드 수: 19, `post` 엔트리: 19, 매핑 누락: 0
    - `title/url/date/content` 필수 필드 누락: 0
    - `content` 길이 통계: min 135 / avg 3228.7 / max 6594
    - 주요 쿼리 매칭 수(`post` 기준): `"의"=18`, `"물리"=10`, `"웹"=4`, `"없는텍스트"=0`
    - CSS 존재성: `@media (max-width: 390px)` 및 페이지 버튼 최소 높이(`min-height: 46px`) 존재
  - 판단: 목록-인덱스 정적 정합성은 유지, 검색 경로/데이터 축적은 안정적.
  - 미검증 항목은 변함없이 브라우저 직접 상호작용(실제 페이지네이션/0건 복구 동선·네트워크 실패 fallback·모바일 포커스)임.

- [2026-09-13 03:35:00KST] 카테고리 키 정합성 기준 보정.
  - 검색 매핑 시뮬레이션에서 일시적으로 나타난 편차(`science/web` 카테고리 쿼리 결과 0건)를 재실행해 확인.
  - 원인: `search.json`의 게시물 카테고리 키가 `category`(단수)이며 이전 스크립트가 `categories` 배열로 가정한 점이 원인.
  - 보정 후 재계산 결과:
    - `category=all, q='물리'` → 10건 (`totalPages=1`, `page=1`, `1-10`)
    - `category=science_philosophy_history, q='물리'` → 5건 (`totalPages=1`, `page=1`, `1-5`)
    - `category=web_technologies, q='웹'` → 3건 (`totalPages=1`, `page=1`, `1-3`)
    - `category=all, q='의', page=2` → 18건 (`totalPages=2`, `page=2`, `11-18`)
  - 미검증 항목은 동일하게 브라우저 런타임 상호작용(네비게이션/복구/포커스)은 미실행 상태.

- [2026-09-13 03:50:00KST] 런타임 제약 하 정적 UI 계약 재확인 라운드.
  - `bundle exec jekyll build` 뒤 `_site/posts/index.html`에서 필수 UI 노드 존재/고유성, 검색 폼 바인딩 포인트를 재확인.
  - 검증 결과:
    - `category-select`/`search-input`/`posts-list`/`pagination`/`page-links`/`prev-page`/`next-page`/`clear-post-filters` 각각 1건 존재.
    - 페이지 뷰 기준 `.search-form`는 1개 존재, `data-search-url`은 `/search.json`.
    - 페이지 번호 링크 생성 요소(`a.page-btn`)는 `aria-label` 누락 없음(현재 정적 스냅샷 기준 0건).
  - 검색 정규화 추가 재점검(카테고리 단일 key 기준):
    - `all + q='의' + page=2` → `total=18`, `totalPages=2`, 표시 `11-18`
    - `science_philosophy_history + q=''` → `total=5`, `totalPages=1`, 표시 `1-5`
    - `web_technologies + q=''` → `total=3`, `totalPages=1`, 표시 `1-3`
    - `daily_life + q=''` → `total=1`, `totalPages=1`, 표시 `1-1`
    - `category=all, q='없는텍스트'` → `total=0`, `totalPages=1`, 표시 `0-0`
  - 미검증은 동일: `/posts/?q=...` 직접 접근 시 실제 0건 UI 문구/복구 동작, 네트워크 실패 폴백 메시지(오프라인), 모바일 실기기 터치·포커스/탭 플로우.

- [2026-09-13 03:55:00KST] 정적 검증 라운드(브라우저 미지원 환경 보강).
  - 실행: `node --check` on `assets/js/{posts.js,main.js,simple-search.js,post-toc.js,analytics-events.js}`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`, 정적 산출물/시뮬레이션 스크립트 재실행.
  - 정량 결과:
    - `_site/search.json` 수집: `post=19`, `page=7`, `total=26`.
    - 핵심 쿼리 매칭(post 기준): `"의"=18`, `"물리"=10`, `"웹"=4`, `"없는텍스트"=0`.
    - `_site/posts/index.html` 필수 노드 누락 없음: `toggle-posts`, `category-select`, `search-input`, `posts-list`, `pagination`, `page-links`, `page-info`, `prev-page`, `next-page`, `posts-count`, `posts-empty-state`, `posts-empty-message`, `clear-post-filters`, `posts-search-status`.
    - ID 중복: 0건.
    - 정적 페이지 버튼 라벨 상태: `a.page-btn` 라벨 누락 없음.
    - JS 소스 자체 체크: `IME composition guard`와 `필터 초기화 문구` 패턴 확인(입력 안정성/복구 메시지 경로는 존재).
    - "의" 검색 1페이지 기준 정규화: 18건, page=2 표시 구간 11-18.
  - 제약 재확인: 로컬 정적 서버 바인딩은 여전히 `Operation not permitted`로 실행되지 않아 `/posts/?q=...` 입력 후 0건/복구, 네트워크 실패 fallback, 390px 터치·포커스 체감은 브라우저에서 직접 확인 불가.
  - 다음 단계: 브라우저 실행 가능한 환경에서 `q=없는텍스트`(0건), `science_philosophy_history&q=물리&page=2`, `all&q=의&page=2`, 오프라인 상태에서 `posts-search-status` 가시성의 체감 확인을 우선 수행.

- [2026-09-13 04:00:00KST] 코드 경로 근사 시뮬레이션 확장 라운드.
  - 실행: `python3` 시뮬레이터(현재 `posts.js` 정규화 규칙을 정적 재현)로 6개 상태를 재계산.
  - 정량 결과:
    - `all + q='' + page=1`: total=19, totalPages=2, normalized page=1, 페이지 텍스트=`전체 19건 중 1-10건`, 페이지 링크=`[1, 2]`, `paginate=True`.
    - `all + q='의' + page=2`: total=18, totalPages=2, normalized page=2, 범위=`전체 18건 중 11-18건`, 링크=`[1, 2]`.
    - `all + q='없는텍스트' + page=1`: total=0, totalPages=1, normalized page=1, `page-info='표시할 글이 없습니다'`, `empty-state='"없는텍스트" 검색어로 일치하는 글이 없습니다...'` 메시지 경로 확인.
    - `science_philosophy_history + q='물리' + page=2`: total=5, totalPages=1, normalized page=1, 범위=`전체 5건 중 1-5건`.
    - `web_technologies + q='웹' + page=3`: total=3, totalPages=1, normalized page=1, 범위=`전체 3건 중 1-3건`.
    - `daily_life + q='' + page=1`: total=1, totalPages=1, 범위=`전체 1건 중 1-1건`.
  - 오프라인 안내 문구 근사 계산(코드 경로):
    - `searchIndex loaded=false` 또는 `failed=false` → 안내문 `hidden`.
    - `loaded=true, failed=true` + 결과 존재 → `오프라인/네트워크 환경... 현재 전체 목록에서 제목·요약 기반 검색을 사용 중입니다.`
    - `loaded=true, failed=true` + 결과 0건 → `오프라인/네트워크 환경... 검색 결과가 없어 제목·요약으로만 검색했습니다.`
  - 해석: 페이지 정규화/0건 메시지 라벨·오프라인 안내 조합은 코드 경로상 일관되어 있으며, 브라우저 실행 환경 미지원 상태에서는 동작 시점 검증만 남음.

- [2026-09-14 00:00:00KST] 계획 라운드 연장(정적 파이프라인/상태 모델 재점검).
  - 실행:
    - `node --check assets/js/posts.js assets/js/simple-search.js assets/js/main.js assets/js/post-toc.js`
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`
    - `_site/search.json` 파서 + 상태 시뮬레이션 스크립트 재실행
  - 결과:
    - `_site/search.json` 건수: `26` (`post: 19`, `page: 7`), 필수(`title`,`url`,`date`) 누락 없음.
    - `/posts` 핵심 시나리오(정적 재현):
      - `all + q='의' + page=2` → 총18건 / 총페이지2 / 정규 page=2 / 범위 `11-18`
      - `all + q='없는텍스트' + page=1` → 총0건 / 총페이지1 / 정규 page=1 / `표시할 글이 없습니다`
      - `science_philosophy_history + q='물리' + page=2` → 총5건 / 총페이지1 / 정규 page=1 / 범위 `1-5`
      - `web_technologies + q='웹' + page=3` → 총3건 / 총페이지1 / 정규 page=1 / 범위 `1-3`
      - `invalid category + page=1` URL 진입은 `getCurrentUrlState` 단계에서 `category=all`로 폴백되어 19건 목록 처리 경로로 복귀함.
    - 정적 HTML 점검:
      - `#posts-empty-state`, `#posts-empty-message`, `#clear-post-filters`, `#posts-search-status` 존재.
      - `.page-btn` 요소 링크/aria 라벨은 정적 스냅샷 기준 누락 없음.
      - id 중복 없음.
  - 미검증: 브라우저/네트워크 상태에서의 실제 렌더링(실시간 검색어/포커스/터치, 네트워크 실패 후 오프라인 문구 노출)은 여전히 수동 검증 대기 상태로 유지.

- [2026-09-14 00:15:00KST] `/posts` 정적 산출물 무결성 보강.
  - `_site/posts/index.html`에서 `id` 중복 점검:
    - 페이지 내부 `id` 총 20개, 중복 없음.
    - 필수 제어점(`toggle-posts`, `category-select`, `search-input`, `posts-list`, `pagination`, `page-links`, `page-info`, `prev-page`, `next-page`, `posts-empty-state`, `posts-empty-message`, `clear-post-filters`, `posts-search-status`) 모두 1건씩 존재.
  - `_site/posts/index.html`를 대상으로 한 전역 검사 스크립트는 동일 파일 내 중복/누락 없음으로 통과.
  - 해석: 정적 산출물 기준으로 `/posts` UI 핵심 제어점의 무결성은 유지됨.

- [2026-09-14 00:30:00KST] 정적 시뮬레이션/산출물 교차 검증 보강.
  - 실행: `_site/search.json` + `_site/posts/index.html` + `assets/css/theme-atlas.css` 정합성 스크립트 1회 재실행.
  - 정량 결과:
    - `search_filter` 정규화 시나리오:
      - `all + q='' + page=1` → 총 19 / 총페이지 2 / page=1 / 범위 1-10
      - `all + q='의' + page=2` → 총 18 / 총페이지 2 / page=2 / 범위 11-18
      - `science_philosophy_history + q='물리' + page=2` → 총 5 / 총페이지 1 / page=1 / 범위 1-5
      - `web_technologies + q='웹' + page=3` → 총 3 / 총페이지 1 / page=1 / 범위 1-3
      - `all + q='물리' + page='2.1'` → 총 10 / 총페이지 1 / page=1 / 범위 1-10
      - `invalid + q='물리' + page=1` → 총 0 / 총페이지 1 / page=1 / 범위 0-0
    - `_site/posts/index.html`:
      - `.post-preview h2 a[href]` 수 19 (중복 제거 시 19).
      - `page` 제어/빈 상태 제어 `id` 12개 모두 1건 존재.
    - CSS 확인:
      - `@media (max-width: 390px)` 존재.
      - `.page-btn` 최소 높이 규칙(`min-height: 46px`) 존재.
  - 교차 검증 주의:
    - 링크 총계는 각 카드 내부 `h2 a`와 “읽기” 링크를 함께 잡을 때 38개로 중복 보임. 제목 링크 기준으로 집계하면 19개여서 `search.json` post 항목(19개)과 1:1 매핑이 일치.
  - 미검증은 이전과 동일: 브라우저에서의 실제 입력/포커스/터치/네트워크 단절 시 렌더 동작은 여전히 수동 확인 대기.

- [2026-09-14 00:45:00KST] 제어점 계약 체크리스트 정형화.
  - 실행: `_site/posts/index.html` + `_site/search.json`을 대상으로 한 스키마/구조 검사 스크립트 1회 실행.
  - 결과:
    - `required_ids` 모두 존재:
      `toggle-posts`, `category-select`, `search-input`, `posts-list`, `pagination`, `page-links`, `page-info`, `prev-page`, `next-page`, `posts-count`, `posts-empty-state`, `posts-empty-message`, `clear-post-filters`, `posts-search-status`.
    - `/posts` 페이지 내부 `id` 중복 없음.
    - `.post-preview` 19개(visible 10 + hidden 9) — 첫 화면 기본 10개 노출 계약과 일치.
    - `data-title`/`data-description`/`data-content` 누락 없음(19/19). `data-tags`는 비어 있는 글이 있어 18개 미기재이므로 fallback 검색은 빈 문자열 경로로 처리됨.
    - 카테고리 옵션: `['all', 'daily_life', 'mathematics_philosophy_history', 'science_philosophy_history', 'web_technologies']`
    - `search.json`: 총 26건(`post:19`, `page:7`), 포스트 항목 필수 필드 누락 없음.
  - 주의: `#page-links`는 초기 정적 스냅샷에서 JS 미실행 상태이므로 비어 있음.

- [2026-09-14 00:50:00KST] 실행 환경 확인(브라우저 자동화 대체 경로 검토).
  - 시도/확인:
    - Node 기반 헤드리스 브라우저 의존성(`playwright`, `puppeteer`, `jsdom`) 존재 여부 확인 → 설치 없음으로 확인.
    - Python 기반 자동화 의존성(`playwright`, `selenium`) 확인 → 설치 없음.
    - 정적 파일 서빙(로컬 서버 기동)도 기존 제약(`Operation not permitted`)으로 반복 실패.
  - 영향: 실 브라우저에서의 0건 안내/복구 버튼 동작, 네트워크 실패 폴백 표시, 390px 터치·포커스 검증은 현재 환경에서 계속 미실행.
  - 보조 경로: 사용 환경에서의 브라우저 점검 항목은 향후 런타임 가능 환경에서 동일 시나리오 재검증 필요 (`/posts/?q=없는텍스트`, `/posts/?category=science_philosophy_history&q=물리&page=2`, `/posts/?q=의&page=2`).

- [2026-09-14 09:56:55KST] `/posts` 정렬/URL 상태 반영 라운드 이어서 수행.
  - 실행: `node --check assets/js/posts.js assets/js/simple-search.js assets/js/main.js assets/js/post-toc.js assets/js/analytics-events.js`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`, 정적 `posts.html` 렌더 산출물 검증 + Python 정적 시뮬레이션으로 `sort=relevance` 시나리오 보강.
  - 정량 결과:
    - 정적 자바스크립트 문법 검사: 통과.
    - Jekyll 빌드: 정적 산출물 생성 성공(로케일 고정시 US-ASCII 변환 에러 재현 없음).
    - 정적 산출물 무결성:
      - `_site/posts/index.html`에 `sort-select`, `posts-search-status`, `posts-empty-state`, `page-links` 모두 존재.
      - 제어점 `id` 중복 없음.
    - `sort=relevance` 경로 정적 재현(요약):
      - `all + q='의' + sort=relevance + page=2` → 총18건, 총페이지2, 정규화된 페이지2.
      - `science_philosophy_history + q='물리' + sort=relevance` → 총5건, 총페이지1.
      - `web_technologies + q='웹' + sort=relevance` → 총3건, 총페이지1.
  - 정성 결과:
    - 정렬 셀렉트에 최소 높이/테두리/배경 스타일 추가로 `/posts` 제어군 일관성 개선.
    - 모바일 390px 구간에서 `sort-select`를 전체 너비로 확장해 터치 타깃 일관성 향상.
  - 미검증: 브라우저 실제 실행 환경에서의 실시간 검색 입력, 포커스 복귀, 네트워크 실패 상태에서 안내 메시지 가시성은 사용자 환경에서 별도 수동 점검 필요.
- [2026-09-14 09:59:07KST] 홈 카드/최근 글 요약 품질 보강 라운드.
  - 실행: `index.html`에서 대표 카드와 최신 글 미리보기 요약 출력 우선순위를 `description` → `excerpt`로 전환.
  - 검증: `node --check assets/js/main.js && node --check assets/js/posts.js && node --check assets/js/simple-search.js && node --check assets/js/post-toc.js && node --check assets/js/analytics-events.js` 통과.
  - 검증: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 산출물 점검(`node` 기반): `_site/index.html` 빌드 산출 크기/생성 정상, `_site/posts/index.html`은 기존 검색·페이지네이션 제어점(`search-input`, `category-select`, `page-links`, `sort-select`, `posts-empty-state`)이 정상 유지되는 것 확인.
  - 미검증: 브라우저에서 실제 화면 렌더링 기반 UX(홈 카드 긴 텍스트 줄바꿈, 토스증권 비교 대상 스타일, 모바일 터치·포커스, 검색 실패 복구) 검증은 계속 대기 상태.
- [2026-09-14 10:00:49KST] 홈 비주얼/타이포 정돈 라운드.
  - 실행: `assets/css/theme-atlas.css`에서 홈/메트릭/카드/액션 톤을 민트 기반으로 보강(`--atlas-teal`, `--atlas-paper` 계열)하고, 전역 제목 계열(`h1/h2/h3`)을 고딕 계열(`var(--atlas-sans)`)로 맞춰 토스증권 느낌의 세로 흐름·가독성/균형을 강화.
  - 검증: `node --check assets/js/main.js assets/js/posts.js assets/js/simple-search.js assets/js/post-toc.js assets/js/analytics-events.js` 통과.
  - 검증: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 산출물 점검: `_site/index.html`에서 home dashboard/featured/recent/post action 마크업 존재, `_site/posts/index.html` 제어 id(`search-input`, `category-select`, `sort-select`, `page-links`, `posts-empty-state`) 존재성 및 중복 없음 확인.
  - 미검증: 브라우저에서 실제 렌더 품질(실제 느낌 개선 체감), 터치/포커스 동선, 오프라인 실패 폴백 UI 가시성은 기존과 동일하게 실기기 수동 점검 대기.
- [2026-09-14 10:02:15KST] 검색 패널 폭/정렬 보강 라운드.
  - 실행: `assets/css/theme-atlas.css`에 검색 결과 패널 강제 정규화를 추가해 사이드바 검색 결과가 요소 너비를 고정하지 않고 `#search-results`/`.search-results`가 래퍼(`.search-container`) 넓이를 따르도록 보정.
    - 대상 규칙: `#search-results`, `.search-container`, `.search-results`, `.sidebar-search .search-results`
  - 검증: `node --check assets/js/main.js assets/js/posts.js assets/js/simple-search.js assets/js/post-toc.js assets/js/analytics-events.js` 통과.
  - 검증: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
  - 산출물 점검: `_site/index.html` 및 `_site/posts/index.html`의 핵심 제어 노드/필수 id 존재성 유지 및 중복 없음 재확인.
  - 미검증: 브라우저에서 223px 고정 패널 체감, 실제 오버레이 시점, 모바일 터치·포커스 동선은 여전히 로컬 브라우저 수동 세션 보류 상태.

- [2026-09-15 15:10:19KST] 검색 인덱스 폴백·복구와 민트 전경색 가독성 보강.
  - 확인된 결함: `posts.js`가 목록 카드의 `data-content`를 폴백으로 준비했지만 검색 점수 계산에서 사용하지 않아, `search.json` 실패 시 본문 앞부분 검색이 실제로 동작하지 않았다. 인덱스가 일부 글만 포함해도 정상 로드로 간주해 결과 범위 누락을 알리지 않았다.
  - 변경:
    - 목록 폴백 검색에 제목·요약·태그·본문 앞 2,400자를 실제 반영하고, 인덱스에서 전체 글의 본문을 매핑했는지 검사한다.
    - 로딩 중과 불완전 인덱스 상태를 검색 결과 옆에 알리고, 0건 문구는 제한된 범위에서 나온 결과임을 설명한다.
    - 실패·누락이 감지되면 검색어·카테고리·정렬·URL 상태를 유지한 채 검색 인덱스를 재시도할 수 있는 키보드 접근 버튼을 제공한다.
    - 계획에 적힌 전경용 짙은 민트 `#087F6B`와 강조용 밝은 민트 `#2DD4BF`를 분리했다. 밝은 색은 링크 글자나 흰 글자 버튼 배경에 쓰지 않고 홈 소개 영역의 장식 강조에 남겼다.
  - 검증:
    - `node --check`로 `posts.js`, `simple-search.js`, `main.js`, `post-toc.js` 문법 검사 통과.
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과.
    - 모의 DOM 런타임에서 네트워크 실패 → 제한 범위 안내/재시도 → 전체 인덱스 성공 후 결과 복구 흐름 통과.
    - 별도 모의 DOM 검사에서 일부 게시물만 포함한 빈 인덱스를 감지하고, 누락된 글의 `data-content` 폴백 검색 및 재시도 노출을 확인.
    - 생성 산출물에서 글 카드 19개와 검색 인덱스 게시물 19개가 모두 매핑되고, 필수 데이터 속성 누락·중복 ID가 없음을 확인.
  - 한계: 모의 DOM과 정적 산출물 검증이며 실제 브라우저·모바일에서의 시각 배치, 스크린 리더 안내, 네트워크 전환은 확인하지 않았다. 변경은 로컬이며 미배포.
  - F04/F05 후속 점검은 아래 2026-09-15 로그에 기록.

- [2026-09-15 15:18:46KST] F04 목차 fragment와 F05 모바일 메뉴 상태 재검증.
  - F04 근거와 변경:
    - 생성된 글 18페이지에서 제목 281개를 점검했다. 제목 ID 누락 0건, 페이지 내부 중복 ID 0건, 제목과 다른 요소 간 ID 충돌 0건이었다.
    - 현 `post-toc.js`는 8개 기존 ID에서 하이픈을 정규화해 주소 fragment와 달라질 수 있었다. 기존 ID를 그대로 보존하고, ID가 없거나 중복·페이지 내 충돌이 있는 제목에만 고유 ID를 생성하도록 수정했다.
    - 모의 DOM에서 비정규 기존 ID 보존, 제목 중복 ID 분리, 비제목 요소 ID와의 충돌 회피, 최종 제목 ID를 가리키는 목차 링크를 확인했다.
  - F05 검증:
    - 현재 `main.js`의 모바일 링크 클릭 닫기·저장 로직을 모의 런타임으로 재현했다.
    - 메뉴 열기 → 글 링크 클릭 → `aria-expanded=false` 및 닫힌 상태 저장 → 다음 페이지 초기화 후 닫힘 유지가 통과했다. 이번 항목에서 추가 코드 수정은 없었다.
  - 검증 한계: 실제 브라우저의 fragment 이동·스크롤·메뉴 전환 시각 효과와 모바일 포커스는 확인하지 않았다.
  - 다음 우선순위: 계획 단계 1의 대표 화면 구성과 시각 검토를 구체화한 뒤, 단계 2에서 Jekyll 정적 페이지와 React/Vite 탐색 영역 연결을 시작한다. Pages 배포 경로는 현재 설정을 확인하기 전까지 변경하지 않는다.

- [2026-09-15 15:39:10KST] 민트 팔레트 유지형 홈 탐색 UI 1차 적용.
  - 확인된 사용성 문제: 공개 홈 화면에서 모바일 통계가 각각 한 줄씩 쌓이고 주제 카드가 먼저 길게 이어져, 검색과 실제 글 진입이 첫 화면 아래로 밀려 있었다. 토스증권 UI의 정보 밀도와 빠른 탐색 흐름을 참고하되 블로그의 연구 노트 성격을 유지하는 방향으로 조정했다.
  - 변경:
    - 홈 소개 영역의 세로 여백을 줄이고 `/posts/?q=...`로 연결되는 검색창을 직접 배치했다. 보이는 라벨, GET 방식, 48px 입력/버튼을 유지한다.
    - 주요 이동 링크와 통계 3개를 작은 화면에서도 3열로 정리하고 바로가기 높이는 44px 이상으로 둔다.
    - 최신 발행 글 1개를 날짜·요약·읽기 링크가 있는 대표 카드로 노출한 다음 최근 글 4개를 분리선 기반 행으로 배치하고, 주제 카드보다 먼저 보여준다.
    - `DESIGN.md`의 YAML 토큰을 실제 CSS와 맞추고 홈 정보 위계 규칙을 갱신했다. 현재 CSS 민트·배경·텍스트 색상값은 이 라운드에서 변경하지 않았다.
  - 검증:
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과. 기존 Faraday 재시도 미들웨어 관련 안내가 출력됐으나 산출물 생성은 성공했다.
    - 변경 영향 파일의 JS 문법 검사와 `git diff --check` 통과.
    - Jekyll 홈 산출물 정적 검사: ID 12개 중복 0건, 라벨 연결된 GET 검색창, 최신 글 → 최근 목록 4개 → 주제 탐색 순서, 모든 홈 내부 링크 대상 존재.
    - 반응형 CSS 정적 검사: 480px 이하에서도 통계·주요 이동이 3열, 검색 조작부 높이 48px, 바로가기 44px 이상, 최근 글 행 스타일을 확인했다.
    - `DESIGN.md` frontmatter YAML 유효, 색상 토큰 16개가 CSS 값과 일치. 핵심 읽기 조합 대비는 잉크/종이 12.65:1, 보조 텍스트/종이 5.84:1, 메타/종이 5.10:1, 흰색/짙은 민트 4.93:1, 짙은 민트/흰색 4.93:1. 강조 민트/흰색은 1.86:1이므로 텍스트 용도에서 제외한다.
  - 시각 검증 한계: 브라우저 보안 정책이 로컬 `file://` 미리보기를 차단했다. 차단 경로를 우회하지 않았으며, 이번 라운드에서는 생성 HTML·CSS 정적 검증만 수행했다. 320/390px 실제 렌더, 스크린 리더·키보드 포커스, 검색 입력 후 `/posts/` 결과 동작은 미검증이다.
  - 상태: 로컬 미배포. 색상은 그대로이며, 다음은 검색·글 목록 화면의 실제 밀도와 상태 표시를 같은 기준으로 개선하고 브라우저 검증 가능한 환경에서 시각 QA를 수행한다.

- [2026-09-15 15:57:00KST] 글 목록 검색 통합과 단일 페이지네이션 모드 적용.
  - 사양·코드 대조:
    - 진실원은 사용자가 계속 따르도록 요청한 이 문서의 페이지네이션 계약이다. §「페이지네이션과 상태 계약」은 “별도 모드를 없애고 하나의 탐색 방식”을 요구한다([계획서](/Users/apple/allenkang92.github.io/docs/002-260908-blog-renewal/260908-renewal-plan-by-codex.md:117)).
    - 변경 전 `posts.js`는 `isExpanded`/`showExpandedPosts()`에서 페이지네이션을 숨겼고, 검색창·카테고리 선택은 글 목록 페이지가 아니라 닫힌 모바일 사이드바 안에 있었다. 그러므로 구현의 두 탐색 모드와 모바일 검색 진입은 계획에 명시된 단일 탐색 흐름과 어긋났다.
    - 사양 내부에는 다른 페이지 예시나 페이지 계약과 충돌하는 지점이 없었다. 의도는 첫 페이지 10개와 URL 기반의 이전·다음/번호 이동으로 목록을 잇는 것으로 판단했다.
    - 정정 방향 A: 계획을 유지하고 코드·화면을 맞췄다. 공개 URL 형식은 바꾸지 않았고, “전체 글 펼치기” 제어만 제거했다.
  - 변경:
    - 검색·카테고리·정렬을 `/posts/` 결과 위에 함께 배치하고, 공통 사이드바 검색/카테고리는 중복되지 않도록 글 목록 페이지에서 숨긴다. 검색 폼은 `/posts/?q=...` GET fallback도 갖는다.
    - 10개씩 보이는 한 가지 목록 흐름으로 정리했다. 검색 또는 카테고리에 10개 초과 결과가 있어도 같은 번호형 페이지네이션과 URL 상태를 사용한다.
    - 결과 카드 대신 분리선 기반 목록 행과 읽기 쉬운 요약을 사용하고, 모바일 필터를 검색 다음 순서로 쌓는다. 작은 화면의 카테고리 선택은 한 열로 넓혀 라벨이 잘리지 않게 한다.
    - `DESIGN.md`에 모바일에서도 검색·필터가 메뉴 안에 숨지 않도록 규칙을 추가했다. 팔레트 변수 값은 변경하지 않았다.
  - 검증:
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`, 변경 영향 JavaScript 문법 검사, `git diff --check` 통과. 빌드 중 Faraday 재시도 미들웨어 안내는 있었지만 Jekyll 산출물 생성은 성공했다.
    - 생성 HTML 검사: 홈·글 목록 ID 중복 없음, `/posts/` 검색 폼 1개, 라벨·GET action·카테고리·정렬·페이지네이션 존재, overlay `simple-search.js`와 펼치기 버튼 부재, 포스트 카드 19개(초기 10개 표시·9개 지연), 내부 링크 대상 모두 존재.
    - `posts.js` 모의 DOM 검사: 전체 19개 → 페이지 2의 9개, 12개 카테고리 → 10개+2개 두 페이지, 본문 키워드 검색, 0건 복구 메시지, 폼 제출 시 URL 반영을 확인했다.
    - CSS 구조·반응형 규칙과 `DESIGN.md` YAML 및 16개 색 토큰 일치를 확인했다.
  - 미검증: 브라우저 보안 정책이 로컬 `file://` 탐색을 차단해 실제 320/390px 화면 렌더와 키보드 포커스·스크린 리더 사용성은 확인하지 못했다. 차단 경로를 우회하지 않았다.
  - 상태: 로컬 미배포. 색상은 그대로이며, 이후 본문·시리즈·도구 화면의 같은 정보 위계 적용과 브라우저 시각 QA가 남아 있다.

- [2026-09-15 16:04:51KST] 글 목록 URL 복원·검색 폴백·빈 상태 잔여 결함 보정.
  - 리뷰에서 확인된 위험: 검색 인덱스 응답 전에 `?q=...&page=2`를 열면 2,400자 정적 폴백만으로 페이지를 정규화해 주소를 1페이지로 덮을 수 있었다. 인덱스 완료 시 이미 바뀐 주소를 다시 읽기 때문에 전체 본문 검색 결과의 2페이지 직접 진입이 복구되지 않는 경로였다.
  - 변경:
    - 검색어가 있고 전체 인덱스가 로딩 중이면 초기 결과를 우선 표시하되 URL 정규화는 미룬다. 인덱스 성공 또는 실패 후 현재 URL을 읽어 실제 결과 수 기준으로 페이지를 정규화하고, 현재 항목을 replace한 다음 같은 조건의 저장 스크롤 위치를 복원한다.
    - 글 목록 검색 입력에 `name="q"`를 지정해 브라우저 기본 GET 제출에서도 검색어가 `/posts/?q=...`에 포함되도록 했다.
    - 빈 결과 상태의 동적 문구와 복구 버튼을 분리했다. 검색 상태만 라이브 영역으로 읽고, 같은 검색어 변경·필터 초기화 안내가 중복 낭독되지 않게 했다. 초기화 버튼은 44px 이상의 조작 높이를 갖는다.
    - 모바일 규칙에서 분리형 목록 행에 덮이는 그림자를 제거하고, 사용처가 없는 이전 featured 카드와 사이드바 카테고리 필터 스타일을 정리했다. 민트·배경·텍스트 색상 토큰은 바꾸지 않았다.
  - 검증:
    - `node --check`로 `posts.js`, `simple-search.js`, `main.js`, `post-toc.js` 통과.
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과. 기존 Faraday 재시도 미들웨어 관련 안내만 출력됐다.
    - 모의 DOM 지연 응답 테스트에서 폴백 검색 0건, 전체 인덱스 검색 12건 조건으로 `?q=needle&page=2`가 요청 전후 유지되고 `전체 12건 중 11-12건`과 2개 카드가 표시됨을 확인.
    - 생성된 `/posts/` HTML에서 중복 ID 없음, 글 19개(초기 10개+숨김 9개), `name=q`가 있는 GET 검색 폼, 검색 제어/페이지네이션 유지, 빈 상태 복구 안내 1회, 현재 민트 토큰 유지 확인.
    - `git diff --check` 통과. 변경 후 코드 리뷰 재점검을 요청해 마지막 race 회귀를 확인 중.
  - 미검증: 실제 브라우저의 모바일 레이아웃·키보드/스크린리더 낭독, 느린 네트워크와 실패 전환을 실기기에서 확인하지 않았다. 브라우저 보안 정책상 기존 세션에서 로컬 파일 프리뷰가 차단되어 우회하지 않았다.
  - 상태: 로컬 미배포. 색상 유지. 다음 단계는 리뷰 잔여 여부 확인 후 글 상세·시리즈·도구 화면의 정보 위계를 개선하고 검증 가능한 로컬 브라우저 경로에서 시각 QA를 재개한다.

- [2026-09-15 16:12:59KST] URL 경합 회귀 보완과 성과 아카이브 UI 정리.
  - 검색 상태 보정:
    - 재검토에서 발견된 popstate 경합을 막기 위해 뒤로/앞으로 이동 시 예약된 입력 검색을 취소하고 URL에서 필드·페이지를 복원한다. 진행 중이던 IME 조합의 늦은 종료 이벤트가 새 탐색 상태를 1페이지로 덮지 않도록 탐색 revision을 확인한다.
    - 검색 인덱스 완료 시 입력이 조합 중이거나 입력 초안과 URL 검색어가 다르면 history를 건드리지 않는다. 이때 검색 인덱스 상태 안내만 완료된 범위로 갱신해 “불러오는 중” 문구가 남지 않게 했다.
  - 성과 페이지 변경:
    - 기존 카드 격자 느낌을 걷고 날짜·분류와 제목·요약이 좌우로 빠르게 읽히는 구분선 기반 목록으로 구성했다. 좁은 화면에서는 메타데이터를 위에 놓고 본문을 아래에 쌓는다.
    - 분류 키를 한국어 라벨로 보여주고, 섹션 이름과 하이라이트 목록을 시맨틱하게 표시한다. 팔레트 색상 토큰은 재사용했다.
    - `DESIGN.md`에 성과 페이지를 간결한 활동 기록으로 구성하는 규칙을 추가했다.
  - 검증:
    - 모의 DOM 상태 테스트 4가지 통과: 검색 인덱스 지연 중 2페이지 직접 진입, 인덱스 응답 전 입력 타이머와 popstate 경합, 기존 debounce 취소, IME 조합 중 URL 커밋 보류와 조합 완료 후 검색 반영.
    - `node --check`로 `posts.js`, `simple-search.js`, `main.js`, `post-toc.js` 통과.
    - Jekyll 빌드·`git diff --check`·`DESIGN.md` YAML 파싱 통과. 산출물에서 성과 5개가 유지되고 한국어 분류 5종, 이름이 있는 섹션 및 반응형 목록 규칙을 확인했다.
    - 앞선 검색 검토 잔여 사항을 재검토해 URL 경쟁 결함 없음으로 확인했다. 실제 브라우저에서 보이지 않는 입력 draft 동안 인덱스가 끝나는 상태 안내는 코드에서 완료 상태를 갱신하도록 추가했다.
  - 미검증: 실제 320/390px 렌더, 키보드/스크린리더 경험은 이 환경의 브라우저 로컬 미리보기 제한으로 확인하지 못했다. 팔레트값·검색 기능은 산출물/모의 DOM에서 확인했다.
  - 상태: 로컬 미배포. 색상은 그대로다. 다음 화면은 상세 글과 시리즈 탐색이며, React/Vite 도입은 계획서의 별도 빌드 기반 단계에서 계속 다룬다.

- [2026-09-15 16:16:00KST] 성과 목록 스타일 적용 범위 점검.
  - 리뷰에서 성과 목록의 Liquid 출력·반응형 구조상 차단 결함과 현재 항목 데이터 누락이 없음을 확인했다. collection 5개, 한국어 카테고리 5종, 중복 ID 0건이다.
  - 공통 `.achievement-title`, `.achievement-date`, `.achievement-content`는 단일 성과 상세 레이아웃에서도 사용된다. 목록 재디자인 규칙을 `.achievements-container` 아래로 제한해 상세 페이지의 관련 성과·날짜·콘텐츠 스타일에는 번지지 않도록 범위를 고정했다.
  - 참고: 개별 collection 문서 본문은 목록에 렌더링되지 않는다. 현재 본문은 Leadership의 placeholder뿐이며 frontmatter 요약·하이라이트·태그는 목록에서 보인다. 실제 상세 서술을 운영 데이터로 추가할 때는 목록 또는 상세 페이지에 본문 연결이 필요하다.
  - 재검증: Jekyll 빌드, JS 구문·검색 URL 상태 테스트, `git diff --check` 통과. 브라우저 시각 검증은 여전히 미완료다.

- [2026-09-15 16:22:55KST] 시리즈 디렉터리의 빠른 탐색 흐름 적용.
  - 확인: 계획상 다음 대표 화면은 시리즈다. 기존 `/series/`는 영문 제목을 사용하고 주요 허브 카드에 긴 `count_label` 문장을 이어 붙였다. 전체 목록은 일부 글에서 `excerpt` 첫머리를 18단어까지 보여 본문 도입부가 길게 노출됐다.
  - 변경:
    - 페이지 제목·주요 분류를 한국어로 맞추고, 대표 허브 2개는 글 수와 짧은 목적 설명을 함께 보이는 카드로 정리했다.
    - 전체 3개 시리즈를 글 순서대로 나누고 각 항목에 순번, 링크 제목, `description` 우선 요약을 둔다. 제목 링크의 조작 영역은 44px 이상이다.
    - 카탈로그 그룹은 중첩 카드 대신 구분선 행으로 표현하고, 모바일에서는 대표 허브를 한 열로 쌓는다. 쓰임이 없어진 `_data/series.yml`의 `count_label` 필드를 제거해 목록/카드 콘텐츠 중복을 줄였다.
    - `DESIGN.md`에 시리즈 허브와 전체 카탈로그의 배치 규칙을 추가했다. CSS 팔레트 토큰은 수정하지 않았다.
  - 검증:
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`, JS 문법 검사, URL·IME 회귀 테스트, `_data/series.yml` YAML 파싱, `git diff --check` 통과.
    - 생성 `/series/`에서 대표 허브 2개, 카탈로그 3개, 순서형 글 항목 18개, 고유 ID, 모든 내부 링크 대상 존재를 확인했다. 현재 색상 토큰과 44px 링크 규칙 유지도 확인했다.
    - 전용 코드 재검토를 요청했다.
  - 미검증: 실제 320/390px 화면 렌더와 키보드/스크린리더 동작은 브라우저에서 확인하지 못했다.
  - 상태: 로컬 미배포. 다음 계획 화면은 글 상세와 도구다. React/Vite 빌드 연결은 해당 UI의 대표 시각 검토와 기존 Pages 빌드 계약 확인 뒤 별도 단계로 진행한다.

- [2026-09-15 16:35:34KST] 도구 화면의 즉시 사용 흐름과 계산 상태 정리.
  - 확인: 계획은 계산 입력·결과를 먼저 보여주고 공식 설명은 뒤에 두도록 한다. 기존 `/tools/`는 계산 안내 링크가 실제 계산기보다 먼저 나오며, 탭·입력 안내·오류에 영문과 한국어가 중복되어 좁은 화면에서 조작부가 길어질 수 있었다.
  - 변경:
    - 계산기 탭을 페이지 첫 작업 영역으로 올리고, 계산 안내는 계산기 아래의 분리선 기반 목록으로 이동했다. 준비 중 상태와 안내 진입을 텍스트로 표시한다.
    - 탭과 폼을 짧은 한국어 라벨로 통일하고, 탭·패널의 `aria-selected`/`hidden` 및 방향키·Home/End 키보드 동작은 유지했다. 입력과 탭 버튼의 터치 높이는 44px 이상이다.
    - 결과와 계산 오류에 구분되는 표면을 주고, 값이 없는 결과 상자는 숨긴다. 기존 CSS 팔레트 토큰 값을 유지했다.
    - 물리 계산에서 질량 0을 일괄 차단하던 검증을 제거했다. 힘·운동/위치 에너지에서 질량 0은 유효한 0 결과이므로 허용하고, 나눗셈 분모인 시간 0만 계속 차단한다.
    - `DESIGN.md`에 도구 영역의 탭 선택과 안내 링크 위계 규칙을 추가했다.
  - 검증:
    - `node --check assets/js/tools.js`, `git diff --check`, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build` 통과. Jekyll 빌드는 Faraday 재시도 미들웨어 안내를 출력했지만 산출물 생성에 성공했다.
    - 모의 DOM으로 탭 포커스·선택 상태·패널 표시 동기화, 질량 0 계산, 시간 0 차단 및 포커스 복귀, 섭씨 0도→화씨 32도 변환, 일반 계산기 0 나눗셈 오류 흐름을 확인했다.
    - 생성 `/tools/`에서 한국어 H1, 계산기→안내 순서, 탭/패널 3쌍, 고유 ID, 입력 라벨 연결, 안내 링크 대상, JS 로드, 16개 민트/배경/텍스트 토큰 값을 확인했다.
  - 미검증: 브라우저에서 320/390px 실제 렌더, 시각적 탭 대비·스크린리더 낭독을 확인하지 않았다. 실 브라우저 검증을 위해 로컬 보안 차단을 우회하지 않았다.
  - 상태: 로컬 미배포. 색상 토큰은 그대로다. 남은 대표 화면은 글 상세·소개·404이며, 이후 운영 자동 검사와 React/Vite 빌드 연결을 별도 단계로 이어간다.

- [2026-09-15 16:42:57KST] 본문 읽기·목차·다음 글 흐름 개선.
  - 확인: 본문 레이아웃은 글의 `description`을 제목 아래에 노출하지 않았고, 자동 생성 목차가 접히지 않은 카드로 본문 앞에 놓여 긴 글에서 세로 탐색 부담이 될 수 있었다. 시리즈 종료부는 다음 글·관련 글·참고 자료를 세 장의 카드로 나눠 강조가 분산됐다.
  - 변경:
    - 글 제목 아래에 요약을 추가하고, 메타정보에서 카테고리를 작성/갱신일보다 먼저 보여준다. Liquid에서 제목과 설명을 HTML escape해 `<자격증>`처럼 꺾쇠 문자가 든 제목이 마크업으로 해석되던 결함도 수정했다.
    - 자동 목차를 네이티브 `<details>/<summary>`로 바꿔 필요할 때 펼치게 했다. `post-toc.js`의 목차 생성 대상 `.toc-list`는 유지했다. 링크 높이는 44px로 키우고 접기 컨트롤에 키보드 포커스를 표시한다.
    - 시리즈 종료부는 다음 글을 먼저 보이는 한 개의 강조 영역으로 두고, 관련 글·참고 자료는 구분선 기반으로 정리했다. 전체 시리즈 목록은 현재 글에 `aria-current="page"`를 주는 기존 계약을 유지한다.
    - `DESIGN.md`에 글 요약·목차 disclosure·다음 글 우선 규칙을 추가했다. 현재 색상 토큰은 바꾸지 않았다.
  - 검증:
    - Jekyll 빌드, `node --check` (`tools.js`, `post-toc.js`), `git diff --check` 통과.
    - 생성된 글 19페이지에서 제목 H1 하나, 요약, 날짜/분류, 댓글 영역, 중복 ID 없음, 자체 fragment 링크 유효, 네이티브 목차 disclosure 존재를 확인했다. 특수문자가 든 글 제목은 HTML escape된 상태로 출력됐다.
    - 도구 재검증에서 질량 0 회귀 계산, 시간 0 오류·포커스, 변환·일반 계산기 오류와 탭 접근성 상태가 통과했다. 빈 결과 live region은 시각적으로만 감추고 접근성 트리에는 남기도록 조정했다.
  - 미검증: 실제 모바일 브라우저 렌더, disclosure와 동적 목차의 스크린 리더 낭독·포커스 복귀는 확인하지 못했다. 색상 토큰 값은 계획서와 현재 `DESIGN.md` 계약에 맞으며 이 변경에서는 수정하지 않았다.
  - 상태: 로컬 미배포. 남은 대표 화면은 소개·404다. 뒤이어 운영 자동 검사와 React/Vite 빌드 연결을 계획 단계에 맞춰 계속한다.

- [2026-09-15 16:50:01KST] 도구 Liquid 출력 결함 보정과 소개·404 복구 흐름 정리.
  - 재검토 정정: 앞선 `/tools/` 정적 검사에서 전체 페이지의 `/tools/` 링크 수를 세어 안내 목록이 정상이라고 판단했지만, 안내 목록 자체를 추적하지 않았다. 코드 리뷰에서 안내 섹션의 raw HTML이 Kramdown 코드 블록으로 출력되는 결함을 확인했다.
  - 변경:
    - 도구 안내 `<section>`에 `markdown="0"`을 지정해 제목과 4개 링크가 실제 HTML로 출력되게 했다. 생성된 `tool-directory-title` ID와 각 URL을 확인한다.
    - 본문 목차 `<details>`는 기본 숨김으로 두고 `post-toc.js`가 링크를 생성한 다음 공개한다. 제목이 없거나 스크립트가 실행되지 않아도 빈 목차 컨트롤을 보이지 않게 한다.
    - 소개 페이지를 영어와 문자 아이콘 카드에서 한국어 짧은 설명과 분리선 링크 목록으로 바꾸고 글·시리즈·도구·성과를 빠른 이동으로 묶었다. 관심 주제 링크는 수학·과학 시리즈와 웹 접근성 글로 연결한다.
    - 404 페이지의 인라인 스타일과 구 색상 하드코딩을 걷어내고 공통 토큰을 사용한다. 라벨이 보이는 GET 검색을 `/posts/?q=...`로 연결하고 전체 글·홈 복구 링크를 제공한다.
    - `DESIGN.md`에 소개와 404 규칙을 추가했다. 팔레트 토큰 값은 바꾸지 않았다.
  - 검증:
    - `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll build`, `node --check` (`tools.js`, `post-toc.js`), `git diff --check` 통과.
    - 생성 `/tools/`에서 안내 항목 실제 앵커 4개, 제목 ID, 계산기 우선 순서와 유효한 대상 파일을 확인했다. HTML 태그가 `&lt;...` 코드 문자열로 노출되지 않는다.
    - `/about/`의 한국어 표기와 2개 정보 그룹, 링크 파일 대상을 확인했다. `/404.html`의 GET `q`, 고유 입력 ID, 검색 라벨, 전체 글·홈 링크, 인라인 스타일 제거를 확인했다.
    - 19개 글의 TOC가 초기 산출물에서는 숨겨지고, 모의 DOM에서 링크가 생성된 경우에만 열리는지·제목이 없으면 계속 숨는지 확인했다.
  - 미검증: 실제 브라우저에서 320/390px 레이아웃, 일본어/한국어 스크린 리더 동작, 404 검색 제출 후 시각적 복귀는 확인하지 않았다. 로컬 미리보기 제한을 우회하지 않았다.
  - 상태: 로컬 미배포. 색상은 현재 디자인 토큰 그대로다. 대표 정적 화면이 정리됐으며 다음 작업은 Pages 빌드 경로를 보존하는 React/Vite 탐색 도입 검토와 운영 자동 검사다.

- [2026-09-15 16:55:31KST] React/Vite 도입 전 Jekyll·Pages 빌드 계약 사전 점검.
  - 로컬 확인 사실:
    - `package.json`에는 Jekyll 명령만 있고 Node 의존성, Vite 설정, TypeScript 설정, npm 잠금 파일이 없다. `node_modules`도 없다.
    - 현재 작업 트리와 기준 커밋에서 `.github/workflows/` 배포 workflow를 찾지 못했다. `/posts/`는 Jekyll이 글 HTML을 생성하고 `posts.js`가 탐색 상태를 처리하는 구성이다.
    - 로컬 Node는 `v22.17.1`, Jekyll은 `3.9.5`다. 기존 `engines.node`는 `>=16.0.0`이므로 Vite 최신 major를 도입하면 엔진 범위를 다시 정해야 한다.
  - 공식 근거와 적용:
    - React는 기존 HTML의 지정된 요소에 `createRoot`로 부분 적용하는 점진적 도입을 안내한다. `createRoot`는 해당 루트 내부 HTML을 덮어쓰므로 정적 글 목록을 fallback으로 남길 때는 React 소유 DOM 경계를 분리해야 한다. [React 기존 프로젝트 통합](https://react.dev/learn/add-react-to-an-existing-project), [createRoot 계약](https://react.dev/reference/react-dom/client/createRoot)
    - Vite는 backend integration에서 production manifest를 생성하고 HTML 측에서 manifest의 JS/CSS 파일을 포함하는 방식을 안내한다. Jekyll/Liquid에 연결하려면 Vite 산출과 Jekyll 렌더 순서를 정해야 한다. [Vite Backend Integration](https://vite.dev/guide/backend-integration)
    - 현재 공식 Vite 8 안내 기준 지원 Node는 `20.19+` 또는 `22.12+`다. 따라서 설치 시 `>=16`을 그대로 두면 지원 계약이 맞지 않는다. [Vite 8 Node 지원](https://vite.dev/blog/announcing-vite8)
    - GitHub Pages는 브랜치 publish와 사용자 정의 GitHub Actions workflow 경로를 제공한다. 브랜치 경로에서 Jekyll 이외의 빌드가 필요하면 custom workflow를 쓰도록 안내한다. [GitHub Pages publish source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
  - 판정 / 변경 범위:
    - React를 Jekyll과 함께 쓰는 것은 가능하다. React는 정적 글 HTML을 대체하지 않고 탐색 인터랙션을 담당하는 방향을 유지한다.
    - 로컬 저장소에서 Pages publish source 자체는 알 수 없다. GitHub API 설정 조회는 이 환경의 네트워크 연결 실패로 완료되지 않았으며, 현재 공개 설정값을 확인한 것으로 간주하지 않는다.
    - 이 사전 점검에서는 배포 workflow, Jekyll 설정, `package.json`, 공개 페이지 스크립트 계약을 변경하지 않았다. 아직 Vite 산출물을 실행할 Pages 경로가 확정되지 않아 React 진입점을 기존 `posts.js`와 함께 올리지 않았다.
    - 다음 구현에서 기존 Pages 경로를 보존하려면 먼저 실제 publish source를 확인하고, Actions 경로면 Vite → Jekyll → Pages artifact를 한 build job에서 검증한다. 브랜치 경로면 Vite 산출물을 publish source에 포함시키는 방식과 재생성 검사를 설계한 뒤 기존 정적 글·검색 fallback을 유지한다.
  - 회귀 검토: 별도 읽기 전용 검토에서 `/tools/`, `/about/`, `/404.html`, 샘플 글의 중복 ID·끊긴 ARIA 참조·검색 복구 경로를 다시 검사했고 추가 actionable finding은 없었다. UTF-8 Jekyll 빌드와 `tools.js`, `post-toc.js` 문법 검사는 통과했다.
  - 미검증: 브라우저의 실제 publish source 및 320/390px 시각 QA. 이 로그 시점의 변경은 로컬 미배포이고, 현재 CSS 색상 토큰값은 그대로 유지했다.

- [2026-09-15 17:02:36KST] Jekyll 산출물 내부 링크·접근성 참조·검색 인덱스 검증기 추가.
  - 변경: 새 의존성을 추가하지 않고 Python 표준 라이브러리 기반 `scripts/verify_site.py`를 만들었다. 빌드 산출물의 중복 ID, label `for`, 주요 ARIA ID 참조, 로컬 href/src/action/poster, 내부 fragment와 검색 JSON URL을 확인한다. 게시글 검색 항목은 `/posts/` 아카이브와 집합을 비교한다. 실행은 `python3 scripts/verify_site.py`다.
  - 첫 실행 보정: 검증기 초안이 사이트 루트(`/`)와 `search.json`의 절대 canonical URL을 외부 링크로 잘못 분류했다. 같은 사이트의 origin을 게시글 URL에서 파악하고 Jekyll의 디렉터리 URL을 `index.html`로 찾도록 수정했다. 이 최초 실패는 사이트 결함이 아니라 검사기 구현 오류였다.
  - 검증:
    - `RUBYOPT=-EUTF-8 bundle exec jekyll build` 통과.
    - 생성 페이지 38개, 로컬 URL 1,080개, fragment 38개, 검색 데이터 26개를 검사해 깨진 경로·중복 ID·누락 ARIA/label 참조 없이 통과.
    - 임시 산출물에 잘못된 내부 URL과 깨진 `aria-labelledby` 참조를 각각 주입했고, 두 결함을 모두 실패로 검출하는 negative check 통과. 임시 복사본은 검증 종료 시 자동 정리했다.
    - Python AST 구문 검사, 변경 영향 JavaScript 5개 파일의 `node --check`, `git diff --check` 통과.
    - `py_compile`은 Python이 `/Users/apple/Library/Caches/...`에 bytecode를 쓰려다 권한 제한으로 실패했다. 캐시를 만들지 않는 AST 검사와 실제 실행 검증은 통과했으며, 권한 제한 우회는 시도하지 않았다.
  - 영향/한계: 이 스크립트는 이미 생성된 `_site/`를 점검하므로 Jekyll build는 먼저 실행해야 한다. 외부 링크의 응답, CSS 배경 URL, 모바일 실제 렌더와 화면 낭독기 동작은 검사하지 않는다. package manifest와 Pages workflow에는 손대지 않았다.
  - 상태: 검색·페이지 UI와 팔레트 변경 없이 운영 점검을 보강했다. React/Vite 산출 경로는 실제 Pages publish source를 알기 전까지 선택하지 않는다. 로컬 미배포.

- [2026-09-15 17:04:07KST] 사이트 검증을 단일 로컬 명령으로 연결.
  - `package.json`에 `npm run verify`를 추가했다. 실행 순서는 Jekyll build 후 `scripts/verify_site.py`이며 외부 Node 패키지 설치나 Pages workflow 실행은 없다.
  - 종단 확인: `RUBYOPT=-EUTF-8 npm run verify` 통과. Jekyll 산출 38페이지를 생성한 뒤 로컬 URL 1,080개, fragment 38개, 검색 항목 26개의 구조 점검이 끝까지 통과했다.
  - `package.json` JSON 파싱과 `git diff --check` 통과. 현재 Node `v22.17.1`에서 검증했다.
- 배포 설정과 팔레트 토큰은 변경하지 않았다. 실제 Pages publish source와 React/Vite 빌드 방식은 미확정이며 배포 전 확인 항목으로 남는다.

- [2026-09-16 09:52:07KST] 글 탐색 React/Vite 연결·검증 완료 및 기존 민트 팔레트 복원.
  - 문제와 범위: Jekyll의 `/posts/`에 검색·분류·정렬·페이지 상태가 따로 흩어져 URL 직접 진입과 전체 결과 이동을 안정적으로 제공하기 어려웠다. 게시글은 Jekyll이 유지하고 목록 탐색만 React로 점진 향상하며, 기존 페이지 URL·색상 팔레트·GitHub Pages 정적 제공과 검색 fallback을 보존하는 범위로 정리했다.
  - 구현:
    - React + TypeScript + Vite를 `/posts/`에 연결했다. Jekyll은 글 19개를 정적 링크로 먼저 렌더링하고, React는 별도 root 안에서 검색 목록을 교체한다. JS를 사용할 수 없거나 모듈이 실패해도 정적 링크는 남는다.
    - Vite가 해시 번들을 생성하고 동기화 스크립트가 `_data/vite_manifest.json`을 쓴다. 해시 번들과 manifest는 브랜치 publish source에서 바로 서빙할 수 있게 저장소에 둔다. Vite/TypeScript 소스와 스크립트는 Jekyll 공개 산출에서 제외했다. 배포 workflow와 Pages 설정은 변경하지 않았다.
    - 순수 TypeScript 검색 모델, URL 상태 어댑터, React UI를 분리했다. 발행 글의 제목·description·본문·분류·태그를 검색하고 시리즈/도구 설명은 검색어가 있을 때만 보조 결과로 제공한다. 여러 검색어는 AND, NFC/공백 정규화와 안정된 정렬을 적용한다.
    - 검색어·분류·정렬·페이지를 URL에 반영하고 직접 URL, 뒤로/앞으로 이동, 새로고침에서 상태를 복원한다. 10건 단위 번호형 페이지네이션, 한글 IME 보류, 입력 지연, 인덱스 오류·재시도, 화면 전환 후 첫 결과 포커스를 처리한다.
    - 중복 ID를 막기 위해 React control ID를 독립 접두사로 구분하고, `posts.js`의 구 목록 컨트롤러는 제거했다. `/posts/`에서 공통 검색 오버레이가 이중으로 동작하지 않게 했다.
    - 실제 검색 결과에서 `/posts/` 자기 자신이 검색되고 페이지 description의 미처리 Liquid가 노출되던 결함을 고쳤다. 페이지 설명은 front matter를 사용하고, 글 하이라이트에 단어 사이 공백이 사라지지 않도록 텍스트 노드를 렌더링한다.
    - 시작 커밋과 현재 토큰을 비교해 색상 팔레트가 달라진 부분을 발견했다. 사용자의 색상 유지 요청에 맞춰 기존 `#F5FFFB`, `#EAF8F2`, `#1F746A`, `#DDF8EF`로 복원하고 새 강조 민트 색을 제거했다. 버튼 그림자는 기존 그림자 토큰을, 빈 상태는 기존 종이색 토큰을 사용한다. 13개 문서/CSS 토큰 일치 검사가 통과했다.
    - 저장소 추적 검토에서 기존 전역 `dist/` ignore 규칙이 Vite 번들도 가리고 있음을 발견했다. `assets/js/dist/` 및 그 하위 파일의 추적 예외를 추가했고, `git check-ignore`와 `git status`에서 해시 번들이 추적 대상임을 확인했다.
    - 계획 상단의 진행 상태·단계 표와 초기 조사 결함의 현재 처리 상태를 맞췄다. 이 문서 아래에 날짜별 변경·검증·한계를 이어 적는다. DESIGN과 README에도 React fallback과 로컬 명령을 반영했다.
  - 검증:
    - `RUBYOPT=-EUTF-8 npm run verify` 통과: TypeScript 검사, Node/Happy DOM 기반 모델·React 통합 테스트 12/12, Vite production build, Jekyll build, site integration 1/1, 구조 검증 38 HTML / 1,060 local URL / 38 fragment / 26 search entry.
    - Vite가 React production bundle 236.98 KB (gzip 74.57 KB)를 생성했고 Jekyll 산출물은 글 fallback 19개·manifest script·검색 데이터 26개를 포함했다. TS 원본·테스트·Vite 설정이 `_site/`에 새지 않음을 integration test로 확인했다.
    - 변경 JavaScript와 Node 스크립트 `node --check`, 13개 팔레트 토큰 일치 스크립트, `git diff --check` 통과.
    - 실제 브라우저에서 `수학` 검색 13건을 확인하고 2페이지 URL에 3개 결과 및 `11–13` 범위가 표시되는 것을 확인했다. 1페이지로 이동하면 `page`가 제거되고 첫 결과 제목 링크로 키보드 포커스가 간다.
    - `/posts/`와 `/achievements/`를 320px·390px에서 확인했다. 문서 너비가 viewport와 같고 가로 넘침이 없었다. 320px 검색창은 234px, 390px에서는 302px였다. 1280px 성과 화면에는 5개 항목이 보이고 가로 넘침이 없었다.
  - 미검증/잔여:
    - 실제 GitHub Pages publish source를 저장소에서 조회할 수 없어 원격 배포 계약은 미확인이다. 해시 파일은 추적 상태로 두었지만 배포·push는 하지 않았다.
    - 전체 페이지의 스크린리더 낭독, 실제 모바일 기기 터치, JavaScript를 끈 브라우저 실행은 전수 검증하지 않았다. 정적 fallback 존재는 빌드 산출물 통합 테스트로 확인했다.
    - 글 front matter 누락/규격 검사는 자동화하지 않았다. F09의 전체 legacy CSS 정리는 별도 유지보수 부채로 남긴다.
- 상태: 검색·페이지네이션과 React/Vite 연결은 로컬 검증 완료, 전체 리뉴얼은 계속 진행 중, 미배포. 팔레트는 저장소 기준 원래 값으로 복원했다.

- [2026-09-16 10:03:55KST] 글 front matter 운영 검사와 기본 UTF-8 빌드 환경 고정.
  - 확인: `BLOG_OPERATIONS.md`는 title·description·작성/수정일·카테고리와 선택 시리즈 정보를 발행 전 확인하도록 하고, `_data/categories.yml`·`_data/series.yml`을 registry로 운영한다. 현재 19개 글에는 등록된 카테고리 4종, 시리즈 3종, 모든 시리즈의 순번이 있다. 시작 시점 plan 색상 표에는 이미 복원한 팔레트와 맞지 않는 예전 값이 남아 있어 기존 토큰 `#F5FFFB`, `#EAF8F2`, `#1F746A`, `#DDF8EF`로 고쳤다.
  - 변경:
    - `scripts/verify_frontmatter.rb`가 UTF-8/YAML front matter delimiter, `layout: post`, title·description, 작성일, 수정일, categories 배열, tags 타입, 카테고리·시리즈 registry 참조, 시리즈별 고유한 0 이상 `series_order`를 검사한다. 두 수정일 필드를 같이 쓰면 시각이 같아야 한다.
    - 7개 Minitest와 33개 assertion으로 정상 문서, 필수 필드 누락, 미등록 registry 값, 잘못된 순번, 날짜 충돌, YAML 오류, 중복 순번을 검증한다. 현 콘텐츠는 수정 없이 통과했다.
    - `run_jekyll.mjs`에서 기존 `RUBYOPT`에 UTF-8 인코딩 옵션을 더해 Jekyll `build`와 `serve`를 실행하도록 했다. 기존 `LC_ALL=C`에서 `bundle exec jekyll build`가 SCSS의 US-ASCII 문자 오류로 실패하는 것을 재현했고, 이후 `npm run verify`는 별도 환경변수 없이 성공했다.
    - `npm run verify`에 front matter 테스트와 저장소 글 검사 단계를 연결하고 README의 운영 규칙·실행 설명을 갱신했다. plan의 현재 색상, 단계 5 상태, 다음 검증 항목도 갱신했다.
  - 검증: 환경변수 없이 `npm run verify` 통과. TypeScript 검사, 검색/React 테스트 12/12, front matter 테스트 7/7, Vite 빌드, UTF-8 Jekyll 빌드, 실제 front matter 검사 19개, 사이트 통합 테스트 1/1, 생성 사이트 검사 38 HTML / 1,060 URL / 38 fragment / 26 search entries. 변경 JS·Node 스크립트 `node --check`, Ruby 스크립트 `ruby -c`, `git diff --check`도 통과.
  - 잔여: 새 콘텐츠의 설명 품질·내부 링크 의미·사실 검증은 자동화하지 않았다. 전체 legacy CSS 구조 정리, 화면 낭독기 검증, 실제 Pages publish source 확인은 남아 있다. 빌드·검증은 로컬에서만 수행했고 배포하지 않았다.
- 상태: 운영 단계의 front matter 기본 회귀 게이트가 준비됐다. 전체 블로그 리뉴얼은 계속 진행 중이며 작업 로그는 이 문서에 누적한다.

- [2026-09-16 10:09:44KST] 생성 HTML 접근성 구조 검사와 회귀 테스트 연결.
  - 확인된 사실: 기존 사이트 검증기는 중복 ID, ID 참조, 내부 URL·fragment와 검색 인덱스만 확인했다. 별도 생성 산출물 점검에서는 모든 실제 콘텐츠 페이지가 `lang`, 제목, H1·main을 갖고 폼·링크·버튼 및 이미지 대체 텍스트에서 실패가 없었다. 검색 인덱스에서 제외된 Jekyll canonical/meta-refresh 리디렉션 페이지는 main landmark 없이 안내 제목과 대체 링크를 제공한다.
  - 변경:
    - `scripts/verify_site.py`에 문서 `lang`, 단일 비어 있지 않은 `<title>`, 단일 `<h1>`, 단일 `<main>`, 이미지 `alt` 속성, 폼 컨트롤·링크·버튼의 이름 단서를 검사하는 규칙을 연결했다.
    - 이름 단서는 `aria-label`, `aria-labelledby`, `title`, 연결/포함 `<label>`, 링크·버튼 텍스트나 이미지 대체 텍스트로 한정한다. 실제 브라우저 접근성 트리의 계산 이름이나 요소의 가시 상태를 판정하지 않는다.
    - 검색에서 제외된 noindex + canonical + meta-refresh 리디렉션 문서는 main landmark 검사만 제외하고, 나머지 문서 제목·H1·링크 검사에는 포함한다.
    - 4개 Python 단위 테스트로 정상 문서, 구조·이름·대체 텍스트 결함, ARIA 이름과 wrapped label, 리디렉션 예외를 고정하고 `npm run test:site-validator` 및 전체 `npm run verify`에 연결했다.
    - README와 이 계획의 현재 단계·검증 한계를 갱신했다. 팔레트·사이트 콘텐츠·배포 설정은 건드리지 않았다.
  - 검증: `python3 -m unittest tests.test_verify_site` 4/4 통과. 환경변수 없이 `npm run verify` 통과: TypeScript, React/model 테스트 12/12, front matter 테스트 7/7, 사이트 검증기 테스트 4/4, Vite/Jekyll 빌드, front matter 19개, 통합 테스트 1/1, 생성 사이트 38 HTML / 1,060 local URL / 38 fragment / 26 search entry. 사이트 검사에서 의미 구조·이름 단서·대체 텍스트·ID/ARIA/label 참조를 모두 통과했다.
  - 잔여: 자동 구조 규칙은 WCAG 적합성 평가가 아니다. 실제 키보드 순서·포커스 복귀, 스크린 리더 낭독, 반응형의 남은 폭, 전체 페이지 가시 상태, 실제 Pages 게시 경로는 확인하지 않았다. 전체 작업은 로컬 미배포이며 GitHub에 push하지 않았다.
  - 다음: 주요 검색·목록·본문·메뉴 플로우를 키보드로 점검하고, 가능한 브라우저에서 실제 320/390/768/1280px 레이아웃 및 스크린 리더 상태를 이어서 확인한다.
