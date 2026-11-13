require 'jekyll'
require 'jekyll-seo-tag'
Dir.chdir(File.expand_path('../../..', __dir__))
raise '버전 불일치' unless Jekyll::SeoTag::VERSION == '2.8.0'
raise 'Jekyll 버전 불일치' unless Jekyll::VERSION == '3.10.0'
config = Jekyll.configuration('source' => Dir.pwd, 'destination' => '/tmp/seo-compat-test-unused', 'quiet' => true)
# 이 시험은 Jekyll과 SEO 플러그인만 비교한다. 블로그의 다른 플러그인을 로드하지 않는다.
config['plugins'] = []
key = "unused\nkey"
injected = "attacker\" />\n<meta name=\"google-site-verification\" content=\"forged"
cases = [
 ['정상 매핑 이름', {key => {'name' => 'Alice'}}, false, nil, 'Alice'],
 ['빈 매핑 이름', {key => {'name' => ''}}, false, nil, ''],
 ['nil 매핑 이름', {key => {'name' => nil}}, false, nil, nil],
 ['false 매핑 이름', {key => {'name' => false}}, false, nil, nil],
 ['정상 소셜 이름', {key => {'name' => 'Alice', 'twitter' => 'alice'}}, false, {'username' => 'blog'}, 'Alice'],
 ['매핑 이름 없음', {key => {'twitter' => 'alice'}}, true, nil, nil],
 ['맵이 아닌 작성자 데이터', {key => ['name']}, true, nil, nil],
 ['매핑 이름 주입', {key => {'name' => injected}}, true, nil, nil],
 ['매핑 소셜 이름 주입', {key => {'name' => 'Alice', 'twitter' => injected}}, true, {'username' => 'blog'}, nil],
 ['소셜 이름 대체값 주입', {key => {'name' => injected, 'twitter' => false}}, true, {'username' => 'blog'}, nil],
]
cases.each do |name, authors, expected_failure, twitter, expected_name|
  site = Jekyll::Site.new(config.merge('title' => 'Test', 'url' => 'https://example.test', 'twitter' => twitter))
  site.data['authors'] = authors
  page = {'title' => 'Test', 'url' => '/', 'author' => key}
  context = Liquid::Context.new(site.site_payload, {}, { :site => site, :page => page })
  context['page'] = page
  begin
    html = Liquid::Template.parse('{% capture input %}{% seo %}{% endcapture %}{% include seo-compat.html source=input %}').render!(context)
    raise '차단 필요' if expected_failure
    raise '위장 메타데이터 출력' if html.include?('<meta name="google-site-verification" content="forged"')
    if expected_name.nil?
      raise '예상치 못한 저자' if html.include?('<meta name="author"')
    else
      raise '출력 이름 불일치' unless html.include?(%(<meta name="author" content="#{expected_name}" />))
    end
    if twitter && authors[key].is_a?(Hash) && authors[key]['twitter'] == 'alice'
      raise '소셜 이름 누락' unless html.include?(%(<meta name="twitter:creator" content="@alice" />))
    end
    puts "통과: #{name}"
  rescue => e
    if expected_failure && e.to_s.include?('ERROR_seo_compat_unsafe_html_metadata')
      puts "통과: #{name}"
    else
      warn "실패: #{name}: #{e.class}: #{e.message}"
      raise
    end
  end
end
puts "SEO #{Jekyll::SeoTag::VERSION}, Jekyll #{Jekyll::VERSION}"
puts 'page.authors 선택:'
cases = [
 ['배열이 아닌 작성자 목록', {'authors' => {'decoy' => 'safe'}}, injected, true],
 ['nil 목록 대체', {'authors' => nil}, injected, true],
 ['빈 목록 대체', {'authors' => []}, injected, true],
 ['첫 항목 nil 대체', {'authors' => [nil]}, injected, true],
 ['첫 항목 빈 값 대체', {'authors' => ['']}, injected, true],
 ['첫 항목 정상 작성자 선택', {'authors' => ['Alice']}, injected, false],
 ['첫 항목 false 선택', {'authors' => [false]}, injected, false],
 ['명시적 false 선택', {'author' => false, 'authors' => {'decoy' => 'safe'}}, injected, false],
 ['작성자 배열 주입 차단', {'authors' => [injected]}, 'Alice', true],
 ['정상 사이트 작성자', {'authors' => {'decoy' => 'safe'}}, 'Alice', false],
]
cases.each do |name, extra, author, expected_failure|
  site = Jekyll::Site.new(config.merge('title' => 'Test', 'url' => 'https://example.test', 'author' => author))
  page = {'title' => 'Test', 'url' => '/'}.merge(extra)
  context = Liquid::Context.new(site.site_payload, {}, { :site => site, :page => page })
  context['page'] = page
  begin
    html = Liquid::Template.parse('{% capture input %}{% seo %}{% endcapture %}{% include seo-compat.html source=input %}').render!(context)
    raise '차단 필요' if expected_failure
    raise '위장 메타데이터 출력' if html.include?('<meta name="google-site-verification" content="forged"')
    if name == '첫 항목 정상 작성자 선택' || name == '정상 사이트 작성자'
      raise '선택된 작성자 누락' unless html.include?(%(<meta name="author" content="Alice" />))
    elsif name == '첫 항목 false 선택' || name == '명시적 false 선택'
      raise '선택되지 않은 사이트 작성자 출력' if html.include?('<meta name="author"')
    end
    puts "통과: #{name}"
  rescue => e
    if expected_failure && e.to_s.include?('ERROR_seo_compat_unsafe_html_metadata')
      puts "통과: #{name}"
    else
      warn "실패: #{name}: #{e.class}: #{e.message}"
      raise
    end
  end
end
puts 'page.image 선택:'
image_cases = [
 ['사용하지 않는 배열의 줄바꿈', ["unused\nimage"], false],
 ['사용하지 않는 배열 객체', [{'path' => injected}], false],
 ['nil 이미지', nil, false],
 ['불리언 이미지', false, false],
 ['숫자 이미지', 0, false],
 ['정상 문자열 이미지', '/image.png', false],
 ['문자열 이미지 주입', injected, true],
 ['정상 객체 이미지', {'path' => '/image.png', 'alt' => 'safe'}, false],
 ['객체 이미지 경로 주입', {'path' => injected}, true],
 ['객체 이미지 대체 텍스트 주입', {'path' => '/image.png', 'alt' => injected}, true],
 ['사용하지 않는 대체 텍스트', {'alt' => injected}, false],
 ['사용하지 않는 facebook 경로', {'path' => '/image.png', 'facebook' => injected}, false],
]
image_cases.each do |name, image, expected_failure|
  site = Jekyll::Site.new(config.merge('title' => 'Test', 'url' => 'https://example.test'))
  page = {'title' => 'Test', 'url' => '/', 'image' => image}
  context = Liquid::Context.new(site.site_payload, {}, { :site => site, :page => page })
  context['page'] = page
  begin
    html = Liquid::Template.parse('{% capture input %}{% seo %}{% endcapture %}{% include seo-compat.html source=input %}').render!(context)
    raise '차단 필요' if expected_failure
    raise '위장 메타데이터 출력' if html.include?('<meta name="google-site-verification" content="forged"')
    if ['정상 문자열 이미지', '정상 객체 이미지', '사용하지 않는 facebook 경로'].include?(name)
      raise '선택된 이미지 누락' unless html.include?(%(<meta property="og:image" content="https://example.test/image.png" />))
    else
      raise '선택되지 않은 이미지 출력' if html.include?('<meta property="og:image"')
    end
    if name == '정상 객체 이미지'
      raise '선택된 이미지 대체 텍스트 누락' unless html.include?(%(<meta property="og:image:alt" content="safe" />))
    end
    puts "통과: #{name}"
  rescue => e
    if expected_failure && e.to_s.include?('ERROR_seo_compat_unsafe_html_metadata')
      puts "통과: #{name}"
    else
      warn "실패: #{name}: #{e.class}: #{e.message}"
      raise
    end
  end
end
