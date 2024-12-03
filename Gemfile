source "https://rubygems.org"

# GitHub Pages와 함께 사용되는 기본 gem
gem "github-pages", group: :jekyll_plugins

# 추가 Jekyll 플러그인
group :jekyll_plugins do
  gem "jekyll-sitemap"
  gem "jekyll-redirect-from"
end

# Windows와 JRuby 플랫폼을 위한 의존성
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", "~> 1.2"
  gem "tzinfo-data"
end

# Windows 개발 환경을 위한 의존성
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]