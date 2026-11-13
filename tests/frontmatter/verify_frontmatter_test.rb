require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'

require_relative '../../scripts/verify_frontmatter'

class FrontmatterVerifierTest < Minitest::Test
  CATEGORIES = ['mathematics_philosophy_history']
  SERIES = ['Mathematics-Philosophy-History']

  def setup
    @metadata = {
      'layout' => 'post',
      'title' => '테스트 글',
      'description' => '검색과 목록에서 내용을 구분하는 짧은 설명입니다.',
      'date' => Time.new(2024, 9, 11, 20, 37, 0, '+09:00'),
      'date_modified' => Time.new(2026, 5, 5, 0, 0, 0, '+09:00'),
      'last_modified_at' => Time.new(2026, 5, 5, 0, 0, 0, '+09:00'),
      'categories' => ['mathematics_philosophy_history'],
      'series' => 'Mathematics-Philosophy-History',
      'series_order' => 0,
      'tags' => 'personal',
    }
  end

  def test_accepts_current_post_metadata_contract
    errors = FrontmatterVerifier.validate_entry(
      data: @metadata,
      path: '_posts/example.md',
      categories: CATEGORIES,
      series: SERIES,
    )

    assert_empty errors
  end

  def test_reports_missing_required_fields_and_update_date
    data = @metadata.reject { |key, _value| %w[title description date categories date_modified last_modified_at].include?(key) }

    errors = FrontmatterVerifier.validate_entry(
      data: data,
      path: '_posts/incomplete.md',
      categories: CATEGORIES,
      series: SERIES,
    )

    assert_includes errors.join("\n"), 'title'
    assert_includes errors.join("\n"), 'description'
    assert_includes errors.join("\n"), 'date'
    assert_includes errors.join("\n"), 'categories'
    assert_includes errors.join("\n"), "'date_modified' or 'last_modified_at'"
  end

  def test_rejects_unknown_categories_and_series
    data = @metadata.merge(
      'categories' => ['unknown_category'],
      'series' => 'Unknown-Series',
    )

    errors = FrontmatterVerifier.validate_entry(
      data: data,
      path: '_posts/unregistered.md',
      categories: CATEGORIES,
      series: SERIES,
    )

    assert_includes errors.join("\n"), 'unknown_category'
    assert_includes errors.join("\n"), 'Unknown-Series'
  end

  def test_requires_a_non_negative_series_order_and_rejects_order_without_series
    missing_order = @metadata.reject { |key, _value| key == 'series_order' }
    errors = FrontmatterVerifier.validate_entry(
      data: missing_order,
      path: '_posts/missing-order.md',
      categories: CATEGORIES,
      series: SERIES,
    )
    assert_includes errors.join("\n"), 'series_order'

    negative_order = FrontmatterVerifier.validate_entry(
      data: @metadata.merge('series_order' => -1),
      path: '_posts/negative-order.md',
      categories: CATEGORIES,
      series: SERIES,
    )
    assert_includes negative_order.join("\n"), 'non-negative integer'

    orphan_order = FrontmatterVerifier.validate_entry(
      data: @metadata.reject { |key, _value| key == 'series' },
      path: '_posts/orphan-order.md',
      categories: CATEGORIES,
      series: SERIES,
    )
    assert_includes orphan_order.join("\n"), "'series_order' requires 'series'"
  end

  def test_rejects_inconsistent_modified_dates
    data = @metadata.merge('last_modified_at' => Time.new(2026, 5, 6, 0, 0, 0, '+09:00'))
    errors = FrontmatterVerifier.validate_entry(
      data: data,
      path: '_posts/date-conflict.md',
      categories: CATEGORIES,
      series: SERIES,
    )

    assert_includes errors.join("\n"), 'must match'
  end

  def test_parses_yaml_front_matter_and_rejects_missing_or_malformed_blocks
    content = <<~POST
      ---
      layout: post
      title: Test
      categories: [mathematics_philosophy_history]
      ---
      Body
    POST
    data, errors = FrontmatterVerifier.parse_front_matter(content, '_posts/sample.md')
    assert_equal 'Test', data['title']
    assert_empty errors

    _data, missing_errors = FrontmatterVerifier.parse_front_matter("layout: post\n", '_posts/no-frontmatter.md')
    assert_includes missing_errors.join("\n"), 'must start and end with ---'

    invalid_yaml = FrontmatterVerifier.parse_front_matter("---\nlayout: [\n---\n", '_posts/bad-yaml.md')
    assert_includes invalid_yaml[1].join("\n"), 'invalid YAML'
  end

  def test_detects_duplicate_series_positions
    records = [
      { path: '_posts/first.md', data: @metadata },
      { path: '_posts/second.md', data: @metadata },
    ]

    errors = FrontmatterVerifier.validate_series_order_collisions(records)

    assert_includes errors.join("\n"), 'duplicate series_order 0'
  end

  def test_achievement_url_policy_accepts_relative_and_web_urls
    ['/assets/a.png', '../project', '?q=a:b', '#section', '//example.org/p', 'HTTPS://example.org/p'].each do |value|
      assert_nil FrontmatterVerifier.achievement_url_error(value), value.inspect
    end
    errors = FrontmatterVerifier.validate_achievement_urls(
      data: { 'certificate_image' => '/a.png', 'project_detail' => 'javascript:alert(1)' },
      path: '_achievements/example.md',
    )
    assert_equal 1, errors.length
    assert_includes errors.first, '_achievements/example.md'
    assert_includes errors.first, 'project_detail'
    assert_includes errors.first, 'http://'
    assert_empty FrontmatterVerifier.validate_achievement_urls(
      data: { 'certificate_image' => false, 'project_detail' => nil }, path: '_achievements/example.md'
    )
  end

  def test_achievement_url_policy_rejects_unsafe_or_invalid_input
    [nil, false, 42, Date.new(2025, 1, 1), [], {}, '', ' https://example.org', "https://example.org\u00a0",
     "java\tscript:alert(1)", "a\u0000b", '/\\example.org', 'data:image/png;base64,AAAA',
     'mailto:person@example.org', 'http:example.org', 'https://', '//', '//?x=1',
     '///example.org/path'].each do |value|
      refute_nil FrontmatterVerifier.achievement_url_error(value), value.inspect
    end
  end

  def test_verify_reads_achievement_url_fields
    Dir.mktmpdir('frontmatter-achievement-') do |directory|
      posts = File.join(directory, '_posts')
      achievements = File.join(directory, '_achievements')
      FileUtils.mkdir_p([posts, achievements])
      categories = File.join(directory, 'categories.yml')
      series = File.join(directory, 'series.yml')
      File.write(categories, YAML.dump('main' => { CATEGORIES.first => {} }))
      File.write(series, YAML.dump('items' => [{ 'key' => SERIES.first }]))
      File.write(File.join(posts, 'post.md'), "#{YAML.dump(@metadata)}---\n본문\n")
      achievement = File.join(achievements, 'example.md')
      File.write(achievement, "---\nproject_detail: 'javascript:alert(1)'\n---\n본문\n")
      arguments = { posts_dir: posts, categories_path: categories, series_path: series, achievements_dir: achievements }
      errors = FrontmatterVerifier.verify(**arguments)
      assert_includes errors.join("\n"), "'project_detail'"
      File.write(achievement, "---\nproject_detail: '/projects/example/'\n---\n본문\n")
      assert_empty FrontmatterVerifier.verify(**arguments)

      html = File.join(achievements, 'unsafe.html')
      text = File.join(achievements, 'unsafe.txt')
      File.write(html, "---\nproject_detail: 'javascript:alert(1)'\n---\n본문\n")
      File.write(text, "---\ncertificate_image: 'data:image/png;base64,AAAA'\n---\n본문\n")
      File.binwrite(File.join(achievements, 'static.png'), "\x89PNG\x00".b)
      errors = FrontmatterVerifier.verify(**arguments)
      assert_includes errors.join("\n"), 'unsafe.html'
      assert_includes errors.join("\n"), 'unsafe.txt'
      refute_includes errors.join("\n"), 'static.png'

      File.write(html, "---\nproject_detail: '/ok'\n---\n본문\n")
      File.write(text, "---\ncertificate_image: '/ok.png'\n---\n본문\n")
      File.write(File.join(achievements, 'no-header.md'), "정적 파일입니다.\n")
      assert_empty FrontmatterVerifier.verify(**arguments)
    end
  end

  def test_verify_reads_internal_file_symlink_as_achievement
    with_achievement_site do |directory, achievements, arguments|
      target = File.join(directory, 'source.md')
      link = File.join(achievements, 'linked.md')
      File.write(target, "---\nproject_detail: 'javascript:alert(1)'\n---\n본문\n")
      File.symlink('../source.md', link)

      errors = FrontmatterVerifier.verify(**arguments)
      assert_includes errors.join("\n"), 'linked.md'
      assert_includes errors.join("\n"), "'project_detail'"

      File.write(target, "---\nproject_detail: '/safe'\n---\n본문\n")
      assert_empty FrontmatterVerifier.verify(**arguments)

      File.write(target, "정적 파일입니다.\n")
      assert_empty FrontmatterVerifier.verify(**arguments)

      image = File.join(directory, 'image.png')
      File.binwrite(image, "\x89PNG\x00".b)
      File.symlink('../image.png', File.join(achievements, 'image.png'))
      assert_empty FrontmatterVerifier.verify(**arguments)
    end
  end

  def test_verify_reports_external_broken_and_directory_symlinks
    with_achievement_site do |directory, achievements, arguments|
      Dir.mktmpdir('frontmatter-outside-') do |outside|
        outside_file = File.join(outside, 'outside.md')
        File.write(outside_file, "---\nproject_detail: '/safe'\n---\n")
        File.symlink(outside_file, File.join(achievements, 'external.md'))
        File.symlink(outside_file, File.join(achievements, '.external.md'))
        File.symlink('not-found.md', File.join(achievements, 'missing.md'))
        File.symlink('self.md', File.join(achievements, 'self.md'))
        # A link to the site root would create a cycle if traversed.
        File.symlink(directory, File.join(achievements, 'cycle'))
        # Hidden regular documents are excluded by default and should not be read.
        File.write(File.join(achievements, '.ignored.md'), "---\nproject_detail: 'javascript:alert(1)'\n---\n")

        errors = FrontmatterVerifier.verify(**arguments)
        assert_equal 4, errors.length
        assert_match(/external\.md: symbolic link target is outside the site root/, errors.join("\n"))
        refute_match(/\.external\.md/, errors.join("\n"))
        assert_match(/missing\.md: symbolic link target cannot be resolved/, errors.join("\n"))
        assert_match(/self\.md: symbolic link target cannot be resolved/, errors.join("\n"))
        assert_match(/cycle: symbolic link must target a regular file/, errors.join("\n"))
      end
    end
  end

  def test_verify_rejects_symlinked_achievement_directory_even_with_trailing_slash
    with_achievement_site do |directory, _achievements, arguments|
      Dir.mktmpdir('frontmatter-outside-directory-') do |outside|
        File.write(File.join(outside, 'file.md'), "---\nproject_detail: '/safe'\n---\n")
        link = File.join(directory, 'linked-achievements')
        File.symlink(outside, link)

        errors = FrontmatterVerifier.verify(**arguments.merge(achievements_dir: "#{link}/"))
        assert_equal 1, errors.length
        assert_includes errors.first, 'achievement directory cannot be a symbolic link'
      end
    end
  end

  def test_verify_rejects_sibling_with_site_root_as_string_prefix
    with_achievement_site do |directory, achievements, arguments|
      prefix = "#{File.basename(directory)}-other-"
      Dir.mktmpdir(prefix, File.dirname(directory)) do |outside|
        target = File.join(outside, 'file.md')
        File.write(target, "---\nproject_detail: '/safe'\n---\n")
        File.symlink(target, File.join(achievements, 'sibling.md'))

        errors = FrontmatterVerifier.verify(**arguments)
        assert_equal 1, errors.length
        assert_match(/sibling\.md: symbolic link target is outside the site root/, errors.first)
      end
    end
  end

  private

  def with_achievement_site
    Dir.mktmpdir('frontmatter-achievement-links-') do |directory|
      posts = File.join(directory, '_posts')
      achievements = File.join(directory, '_achievements')
      FileUtils.mkdir_p([posts, achievements])
      categories = File.join(directory, 'categories.yml')
      series = File.join(directory, 'series.yml')
      File.write(categories, YAML.dump('main' => { CATEGORIES.first => {} }))
      File.write(series, YAML.dump('items' => [{ 'key' => SERIES.first }]))
      File.write(File.join(posts, 'post.md'), "#{YAML.dump(@metadata)}---\n본문\n")
      arguments = { posts_dir: posts, categories_path: categories, series_path: series, achievements_dir: achievements }
      yield directory, achievements, arguments
    end
  end
end
