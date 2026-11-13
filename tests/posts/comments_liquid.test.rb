require 'minitest/autorun'
require 'liquid'

class CommentFallbackLiquidTest < Minitest::Test
  TEMPLATE_PATH = File.expand_path('../../_layouts/post.html', __dir__)
  ISSUE_LIST = 'https://github.com/allenkang92/allenkang92.github.io/issues'.freeze

  def render_comments(value)
    source = File.read(TEMPLATE_PATH)
    fragment = source[/\{% assign comment_issue_raw.*?<\/section>/m]
    refute_nil fragment, '댓글 템플릿이 존재해야 합니다'
    Liquid::Template.parse(fragment).render!('page' => { 'comment_issue_number' => value })
  end

  def test_양의_정수만_직접_이슈에_연결한다
    [1, 3, '42', ' 42 '].each do |value|
      html = render_comments(value)
      number = value.to_s.strip
      assert_includes html, "href=\"#{ISSUE_LIST}/#{number}\""
      assert_includes html, "issue-number=\"#{number}\""
      refute_includes html, 'issue-term="pathname"'
    end
  end

  def test_잘못된_번호는_목록과_기본_경로를_사용한다
    [nil, false, 0, -1, 1.0, 1.5, '1.0', '1.5', '001', '1abc',
     '1/../../etc', '1" onmouseover="alert(1)', ''].each do |value|
      html = render_comments(value)
      assert_includes html, "href=\"#{ISSUE_LIST}\""
      assert_includes html, 'issue-term="pathname"'
      refute_includes html, 'issue-number='
    end
  end
end
