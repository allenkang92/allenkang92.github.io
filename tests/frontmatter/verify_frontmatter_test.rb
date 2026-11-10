require 'minitest/autorun'

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
end
