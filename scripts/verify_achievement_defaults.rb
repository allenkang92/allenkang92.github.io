#!/usr/bin/env ruby

# Inspect Jekyll's effective document data so inherited defaults, path scopes,
# precedence and explicit false/nil are handled by the actual generator.
require 'pathname'
require 'jekyll'
require 'github-pages'
require_relative 'verify_frontmatter'

source = Pathname.new(ARGV.fetch(0, Pathname.new(__dir__).parent.to_s)).expand_path
configuration = Jekyll.configuration(
  'source' => source.to_s,
  'config' => source.join('_config.yml').to_s,
  'quiet' => true,
  'safe' => true,
  'disable_disk_cache' => true,
)
errors = []
site = Jekyll::Site.new(configuration)
site.read
collection = site.collections['achievements']
if collection.nil?
  errors << '성과 컬렉션이 없습니다'
elsif collection.docs.empty?
  errors << '검사할 성과 문서가 없습니다'
else
  collection.docs.each do |document|
    values = %w[certificate_image project_detail].each_with_object({}) do |field, result|
      result[field] = document.data[field]
    end
    errors.concat(FrontmatterVerifier.validate_achievement_urls(data: values, path: document.relative_path))
  end
end

if errors.empty?
  puts "PASS: GitHub Pages 구성의 성과 문서 #{collection.docs.length}개에 실제 적용된 URL이 입력 정책을 따릅니다"
else
  warn "FAIL: 성과 기본값 검사 문제 #{errors.length}건"
  errors.each { |error| warn "- #{error}" }
  exit 1
end
