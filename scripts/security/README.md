# 루비 의존성 검증 후보

이 디렉터리는 보안 권고를 확인하며 시험한 **별도 빌드 후보**다. 저장소 루트의 `Gemfile`과 현재 GitHub Pages 브랜치 기반 배포 설정을 변경하지 않는다. 이 파일을 추가하거나 로컬에서 빌드해도 공개 사이트의 관리형 빌드 의존성은 자동으로 바뀌지 않는다.

2026-11-12에 Ruby 3.3.13과 Bundler 2.5.22를 사용해 후보를 설치하고 Jekyll 빌드와 통합 시험을 실행했다. 이때 잠금 파일의 `github-pages`는 233, `nokogiri`는 1.19.7, `rubyzip`은 3.7.0, `concurrent-ruby`는 1.3.8이었다. 당시 RubyGems 패키지 버전의 OSV 대조에서 일치 권고는 없었지만, 이는 해당 시점의 버전 대조 결과이며 보안 보증이 아니다. 자세한 조사와 공개 빌드의 상태는 [검수와 근거](../../docs/003-261110-security-and-blog-review/검수와-근거.md)에 기록한다.

## 격리 검증

저장소 루트에서 Ruby 3.3, Bundler와 `package.json`의 Node.js 버전 조건(`^20.19.0` 또는 `>=22.12.0`)을 준비한 뒤 실행한다. `npm ci`는 작업 디렉터리의 `node_modules`를 설치하고 프런트엔드 빌드는 번들과 매니페스트를 갱신한다. 루비 의존성과 Jekyll 산출물은 임시 디렉터리에 둔다. 패키지 설치에는 레지스트리 접속과 네이티브 확장 빌드 도구가 필요할 수 있다.

```sh
(
  set -e
  npm ci
  npm run build:frontend
  candidate_dir="$(mktemp -d)"
  export BUNDLE_GEMFILE="$PWD/scripts/security/Gemfile"
  export BUNDLE_PATH="$candidate_dir/gems"
  export BUNDLE_APP_CONFIG="$candidate_dir/config"
  export BUNDLE_FROZEN=true
  bundle install
  bundle check
  TZ=UTC JEKYLL_ENV=production bundle exec github-pages build --source "$PWD" --destination "$candidate_dir/site"
  SITE_ROOT="$candidate_dir/site" npm run test:integration
  python3 scripts/verify_site.py --site-dir "$candidate_dir/site"
)
```

잠금 파일은 macOS와 여러 Linux 플랫폼을 포함하지만, 플랫폼이 기록됐다는 사실은 해당 플랫폼에서 설치와 실행이 검증됐다는 뜻이 아니다. Linux 설치, 네이티브 라이브러리의 실제 버전과 공개 GitHub Pages 빌드에 적용되는 의존성은 별도로 확인해야 한다. 후보 실험에 사용한 임시 Ruby의 libyaml 0.2.5는 운영 환경으로 검증하지 않았다.

2026-11-12에는 기존 의존성 디렉터리와 `.git`을 제외한 macOS 임시 사본에서 `npm ci`와 별도 경로의 고정 Ruby 의존성 설치를 새로 실행했다. 프런트엔드·Jekyll 빌드와 통합 테스트 23건, 생성물 검사가 통과했다. 사본에 `.git`이 없어 빌드 중 Git 메타데이터 관련 경고가 나왔으며, 실제 GitHub Actions 실행을 재현한 것은 아니다.

동일 후보의 `github-pages build` 진입점도 저장소의 현재 수정본에서 별도로 실행해 통합 테스트 23건과 생성물 검사를 통과했다. 이 진입점은 일반 `jekyll build`와 설정이 다를 수 있어 관리형 빌드와 비교할 때 사용한다. 로컬 검증은 GitHub의 실제 이미지 및 배포 설정과 완전히 같다는 뜻은 아니다.

잠금된 버전도 시간이 지나면 새로운 권고의 영향을 받을 수 있다. 의존성을 갱신할 때마다 새 잠금 파일로 패키지와 네이티브 라이브러리를 각각 감사하고, 기존 기능과 생성물의 회귀를 검사한다. 공개 빌드 방식을 바꾸려면 실제 게시 설정과 복구 절차를 별도로 검증해야 한다.

## 수동 Linux 후보 검사

`.github/workflows/pages-candidate-audit.yml`은 Actions에서 수동으로 실행하는 후보 검사다. `contents: read`만 요청하며 Pages 게시 단계가 없다. 잠금된 의존성을 Linux에 설치한 뒤 빌드와 테스트를 수행하고 실제 로드된 Ruby 네이티브 라이브러리 버전을 출력한다. `audit_installed_gems.py`는 설치된 RubyGems 이름과 버전만 OSV로 보내 일치 권고를 확인하며, 응답 누락이나 오류는 실패로 처리한다. 이 조회는 네이티브 라이브러리의 권고별 영향이나 공개 Pages의 현재 빌드 환경을 검증하지 않는다. 실행 결과는 GitHub Actions 로그에서 확인한다.
