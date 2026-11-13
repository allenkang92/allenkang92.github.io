# SEO 2.8 격리 회귀 시험

현재 관리형 Pages에서 확인한 SEO 2.8 템플릿의 출력과 호환 가드를 함께 시험한다. 작성자 선택·이미지 선택에 관한 정상 값과 메타데이터 위장 사례 32개를 실제 `jekyll-seo-tag` 2.8.0, Jekyll 3.10.0, GFM 파서 1.1.0으로 렌더한다. 일반 빌드에 사용하는 SEO 2.9.1은 별도 번들에 남는다. 이 시험은 GitHub Pages 232 전체 실행 환경이나 모든 입력의 보안성을 재현하지 않는다.

## 설치

Ruby 3.3과 Bundler 2.5.22를 준비하고 저장소 루트에서 한 번 실행한다. 네트워크 접속과 네이티브 확장 빌드 도구가 필요하다. `.cache/seo-legacy-bundle`은 Git에서 추적하지 않는 격리 경로다. 부모 프로세스의 일반 Jekyll 번들과 섞이지 않도록 지정한다.

```sh
export SEO_LEGACY_BUNDLE_PATH="$PWD/.cache/seo-legacy-bundle"
env -u BUNDLE_GEMFILE -u BUNDLE_PATH -u BUNDLE_APP_CONFIG -u BUNDLE_BIN_PATH -u RUBYOPT -u RUBYLIB -u GEM_HOME -u GEM_PATH \
  BUNDLE_GEMFILE="$PWD/tests/seo/legacy/Gemfile" \
  BUNDLE_PATH="$SEO_LEGACY_BUNDLE_PATH" \
  BUNDLE_APP_CONFIG="$SEO_LEGACY_BUNDLE_PATH/.bundle-config" \
  BUNDLE_FROZEN=true BUNDLE_DISABLE_SHARED_GEMS=true bundle install
```

## 실행

같은 환경에서 `npm run test:seo-legacy`를 실행한다. `npm run verify`에도 포함되어 있으므로 전체 검증 시에도 `SEO_LEGACY_BUNDLE_PATH`가 필요하다. 값은 절대 경로여야 하며 설정하지 않았거나 번들이 빠져 있으면 통과나 건너뛰기가 아닌 실패를 반환한다. 일반 번들의 `BUNDLE_GEMFILE`, `BUNDLE_PATH`, `BUNDLE_APP_CONFIG`가 설정돼 있어도 이 시험은 별도 번들만 사용한다.

잠금 파일에는 macOS와 Linux의 여러 플랫폼이 기록되어 있지만 이 기록만으로 각 플랫폼에서 설치·동작을 검증했다는 뜻은 아니다. 현재 별도 번들 신규 설치와 시험은 arm64 macOS에서 확인했으며 Linux와 Intel macOS는 미검증이다. 구버전 의존성은 회귀 시험용이며 공개 배포용으로 사용하지 않는다.

`scripts/security/pages-workflow.example.yml`은 실행 중인 배포 설정이 아닌 예시이며, 개별 시험을 호출하기 때문에 이 독립 SEO 2.8 시험을 자동으로 실행하지 않는다. 예시를 실제 워크플로로 전환할 때는 별도 번들 설치와 `npm run test:seo-legacy` 실행을 명시적으로 추가하고 해당 환경에서 검증해야 한다.
