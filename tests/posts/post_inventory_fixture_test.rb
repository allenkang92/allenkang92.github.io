require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require 'json'
require 'open3'
require 'rbconfig'

# 실제 Jekyll 빌드와 독립 검증기를 함께 실행하는 격리 자료다.
class PostInventoryFixtureTest < Minitest::Test
  CHECKER = File.expand_path('../../scripts/verify_post_inventory.rb', __dir__)

  def setup
    @tmp = Dir.mktmpdir('글 목록 검증 ')
    @source = File.join(@tmp, 'source')
    @output = File.join(@tmp, 'site')
    FileUtils.mkdir_p(File.join(@source, '_posts'))
    File.write(File.join(@source, '_config.yml'), <<~YAML)
      url: https://example.test
      baseurl: /blog
      timezone: Asia/Seoul
      theme: null
      exclude: [Gemfile, Gemfile.lock]
    YAML
    write_post('2001-01-01-정상 글.md', "title: 정상 글\npermalink: /posts/정상-글/\n")
    write_post('2001-01-02-비공개.md', "title: 비공개\npublished: false\n")
    write_post('2099-01-01-미래.md', "title: 미래\n")
    write_post('2001-01-03-사이트맵제외.md', "title: 제외\nsitemap: false\n")
    File.write(File.join(@source, 'search.json'), <<~LIQUID)
      ---
      layout: null
      ---
      [{% for post in site.posts %}{% unless forloop.first %},{% endunless %}{"type":"post","url":{{ post.url | absolute_url | jsonify }}}{% endfor %}]
    LIQUID
    File.write(File.join(@source, 'sitemap.xml'), <<~LIQUID)
      ---
      layout: null
      ---
      <?xml version="1.0" encoding="UTF-8"?><urlset>{% for post in site.posts %}{% unless post.sitemap == false %}<url><loc>{{ post.url | replace: '/index.html', '/' | absolute_url | xml_escape }}</loc></url>{% endunless %}{% endfor %}</urlset>
    LIQUID
  end

  def teardown
    FileUtils.remove_entry(@tmp) if @tmp && File.directory?(@tmp)
  end

  def write_post(name, header)
    File.write(File.join(@source, '_posts', name), "---\n#{header}---\n내용\n")
  end

  def run_command(*args)
    Open3.capture3({ 'JEKYLL_ENV' => 'production', 'TZ' => 'UTC' }, RbConfig.ruby, *args)
  end

  def build(*flags, executable: 'jekyll')
    out, err, status = run_command('-S', executable, 'build', '--source', @source, '--destination', @output, *flags)
    assert status.success?, "격리 빌드 실패: #{out}\n#{err}"
  end

  def verify(*flags)
    run_command(CHECKER, '--source', @source, '--site-dir', @output, *flags)
  end

  def test_선택된_글은_색인과_사이트맵에서_함께_빠져도_탐지된다
    build
    out, err, status = verify
    assert status.success?, "정상 빌드 검증 실패: #{out}\n#{err}"
    rows = JSON.parse(File.read(File.join(@output, 'search.json')))
    assert_equal 2, rows.length, '기본 빌드에서는 미발행 글과 미래 글을 제외해야 합니다'
    target = rows.find { |row| row['url'].include?('%EC%A0%95%EC%83%81') }
    refute_nil target, '한글 경로 글이 생성되어야 합니다'
    excluded = rows.find { |row| row['url'] != target['url'] }
    refute_includes File.read(File.join(@output, 'sitemap.xml')), excluded.fetch('url'), 'sitemap: false 글은 색인에만 존재할 수 있습니다'
    rows.delete(target)
    File.write(File.join(@output, 'search.json'), JSON.generate(rows))
    sitemap = File.read(File.join(@output, 'sitemap.xml'))
    File.write(File.join(@output, 'sitemap.xml'), sitemap.sub(%r{<url><loc>#{Regexp.escape(target.fetch('url'))}</loc></url>}, ''))
    refute_includes File.read(File.join(@output, 'sitemap.xml')), target.fetch('url')
    _out, error, status = verify
    refute status.success?, '두 산출물에서 동시에 누락한 글을 검출해야 합니다'
    assert_match(/검색 색인 글 목록 불일치/, error)
  end

  def test_미발행과_미래_글_옵션을_실제_빌드와_맞춘다
    build('--future', '--unpublished')
    rows = JSON.parse(File.read(File.join(@output, 'search.json')))
    assert_equal 4, rows.length
    out, err, status = verify('--future', '--unpublished')
    assert status.success?, "옵션 적용 빌드 검증 실패: #{out}\n#{err}"
  end

  def test_색인은_있고_사이트맵에만_없는_글도_탐지한다
    build
    rows = JSON.parse(File.read(File.join(@output, 'search.json')))
    target = rows.find { |row| row['url'].include?('%EC%A0%95%EC%83%81') }
    refute_nil target
    path = File.join(@output, 'sitemap.xml')
    xml = File.read(path)
    File.write(path, xml.sub(%r{<url><loc>#{Regexp.escape(target.fetch('url'))}</loc></url>}, ''))
    _out, error, status = verify
    refute status.success?, '사이트맵에서만 빠진 게시 글도 검출해야 합니다'
    assert_match(/사이트맵 글 목록 불일치/, error)
  end

  def test_pages_빌드의_미래_글_설정을_따른다
    build(executable: 'github-pages')
    out, err, status = verify('--pages')
    assert status.success?, "Pages 빌드 검증 실패: #{out}\n#{err}"
    build('--future', executable: 'github-pages')
    out, err, status = verify('--pages', '--future')
    assert status.success?, "Pages 미래 글 검증 실패: #{out}\n#{err}"
  end
end
