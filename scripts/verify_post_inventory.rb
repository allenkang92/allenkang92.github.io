#!/usr/bin/env ruby
# Jekyll이 실제 렌더 직전에 선택한 글과 같은 빌드의 색인·사이트맵을 비교한다.
# 테스트용 임시 빌드만 만들며 저장소나 공개 산출물에 목록을 추가하지 않는다.
require 'optparse'
require 'tmpdir'
require 'json'
require 'rexml/document'
require 'jekyll'

options = { source: Dir.pwd, pages: false }
OptionParser.new do |parser|
  parser.banner = 'Usage: bundle exec ruby scripts/verify_post_inventory.rb [options]'
  parser.on('--source PATH') { |value| options[:source] = value }
  parser.on('--site-dir PATH', '별도 생성물과 비교 (빌드 시각·옵션을 동일하게 유지)') { |value| options[:site_dir] = value }
  parser.on('--baseurl PATH') { |value| options[:baseurl] = value }
  parser.on('--pages', 'github-pages build와 동일한 진입점 사용') { options[:pages] = true }
  parser.on('--future', '미래 글 포함') { options[:future] = true }
  parser.on('--unpublished', '미발행 글 포함') { options[:unpublished] = true }
end.parse!

require 'github-pages' if options[:pages]

def normalize_url(value)
  Addressable::URI.parse(value.to_s).normalize.to_s
end

def check_inventory(expected_posts, expected_sitemap, directory)
  search = JSON.parse(File.read(File.join(directory, 'search.json')))
  raise '검색 색인이 배열이 아닙니다' unless search.is_a?(Array)
  indexed = search.select { |row| row.is_a?(Hash) && row['type'] == 'post' }
                  .map { |row| normalize_url(row.fetch('url')) }
  duplicates = indexed.group_by { |url| url }.select { |_url, values| values.length > 1 }.keys
  raise "검색 색인 글 주소가 중복됩니다: #{duplicates.join(', ')}" unless duplicates.empty?

  missing = expected_posts - indexed
  unexpected = indexed - expected_posts
  raise "검색 색인 글 목록 불일치: 누락=#{missing.inspect}, 예상 외=#{unexpected.inspect}" unless missing.empty? && unexpected.empty?

  xml = REXML::Document.new(File.read(File.join(directory, 'sitemap.xml')))
  raise '사이트맵 루트가 urlset이 아닙니다' unless xml.root&.name == 'urlset'
  sitemap = xml.root.elements.to_a('url').map { |entry| normalize_url(entry.elements['loc']&.text) }
  missing_sitemap = expected_sitemap - sitemap
  repeated_posts = expected_sitemap.select { |url| sitemap.count(url) > 1 }
  raise "사이트맵 글 목록 불일치: 누락=#{missing_sitemap.inspect}, 중복=#{repeated_posts.inspect}" unless missing_sitemap.empty? && repeated_posts.empty?

  puts "PASS: Jekyll 게시 글 #{expected_posts.length}개와 검색 색인, 사이트맵 대상 #{expected_sitemap.length}개 일치"
end

Dir.mktmpdir('jekyll-post-inventory-') do |temporary|
  build_options = {
    'source' => File.realpath(options[:source]),
    'destination' => File.realpath(temporary) + '/site',
    'quiet' => true,
    'incremental' => false,
  }
  %i[baseurl future unpublished].each { |key| build_options[key.to_s] = options[key] if options.key?(key) }

  captured = nil
  Jekyll::Hooks.register :site, :pre_render do |site, _payload|
    # 실제 Liquid에서 사용하는 필터와 유효한 빌드 설정을 그대로 사용한다.
    context = Liquid::Context.new({}, {}, { site: site })
    filters = Object.new.extend(Jekyll::Filters::URLFilters)
    filters.instance_variable_set(:@context, context)
    posts = site.posts.docs
    expected_posts = posts.map { |post| normalize_url(filters.absolute_url(post.url)) }
    output_enabled = site.collections.fetch('posts').metadata.fetch('output', true) != false
    expected_sitemap = if output_enabled
                         posts.reject { |post| post.data['sitemap'] == false }
                              .map { |post| normalize_url(filters.absolute_url(post.url.gsub('/index.html', '/'))) }
                       else
                         []
                       end
    raise 'Jekyll 게시 글 주소가 중복됩니다' unless expected_posts.uniq.length == expected_posts.length
    captured = [expected_posts, expected_sitemap]
  end

  Jekyll::Commands::Build.process(build_options)
  raise 'Jekyll 렌더 직전 글 목록을 가져오지 못했습니다' unless captured
  check_inventory(*captured, options[:site_dir] || build_options.fetch('destination'))
end
