import importlib.util
import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('verify_site', ROOT / 'scripts' / 'verify_site.py')
VERIFY_SITE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY_SITE)


class BaseurlVerificationTests(unittest.TestCase):
    def test_cli_checks_baseurl_build_and_archive_without_nested_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            html = '''<html lang="ko"><head><title>예시</title></head><body><main><h1>예시</h1>
              <a href="/blog/posts/one/?q=1#part">글</a></main></body></html>'''
            post = '''<html lang="ko"><head><title>글</title></head><body><main><h1>글</h1>
              <h2 id="part">부분</h2><a href="../../?q=1#top">홈</a></main></body></html>'''
            (root / 'index.html').write_text(html, encoding='utf-8')
            (root / 'posts' / 'one').mkdir(parents=True)
            (root / 'posts' / 'index.html').write_text(html, encoding='utf-8')
            (root / 'posts' / 'one' / 'index.html').write_text(post, encoding='utf-8')
            (root / 'search.json').write_text(json.dumps([
                {'type': 'post', 'url': 'https://blog.test/blog/posts/one/', 'title': '글', 'content': '본문'}
            ]), encoding='utf-8')
            result = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'verify_site.py'),
                                     '--site-dir', str(root), '--baseurl', '/blog'],
                                    capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            (root / 'posts' / 'index.html').write_text(html.replace('/blog/posts/one/', '/blog/'), encoding='utf-8')
            result = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'verify_site.py'),
                                     '--site-dir', str(root), '--baseurl', '/blog'],
                                    capture_output=True, text=True)
            self.assertNotEqual(0, result.returncode)
            self.assertIn('posts archive and search index differ', result.stdout)

    def test_baseurl_boundary_traversal_and_symlink(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'site'
            root.mkdir()
            (root / 'index.html').write_text('root', encoding='utf-8')
            (root / 'one').mkdir()
            page = root / 'one' / 'index.html'
            page.write_text('one', encoding='utf-8')
            (root.parent / 'outside').write_text('outside', encoding='utf-8')
            (root / 'escape').symlink_to(root.parent / 'outside')
            for url in ('/blogger/', '/blog/%2e%2e/outside', '/blog/%2e%2e/blog/one/', '/blog/escape',
                        'https://blog.test/blogger/', 'https://blog.test/blog/%2e%2e/outside'):
                with self.subTest(url=url):
                    self.assertIsNone(VERIFY_SITE.resolve_target(root, page, url, 'https://blog.test', '/blog')[0])
            for url, expected in (('../?q=1#top', root / 'index.html'),
                                  ('/blog/one/?q=1#part', page),
                                  ('https://blog.test/blog/one/?q=1#part', page)):
                with self.subTest(url=url):
                    self.assertEqual(expected, VERIFY_SITE.resolve_target(root, page, url, 'https://blog.test', '/blog')[0])

    def test_unknown_origin_is_reported_when_absolute_urls_exist(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text('''<html lang="ko"><head><title>예시</title></head>
              <body><main><h1>예시</h1><a href="https://blog.test/missing">누락</a></main></body></html>''', encoding='utf-8')
            for entries in ([], [{'type': 'post', 'url': '/', 'title': '글', 'content': '본문'}]):
                with self.subTest(entries=entries):
                    (root / 'search.json').write_text(json.dumps(entries), encoding='utf-8')
                    output = io.StringIO()
                    with contextlib.redirect_stdout(output):
                        self.assertEqual(1, VERIFY_SITE.verify(root))
                    self.assertIn('cannot determine site origin', output.getvalue())

    def test_origin_override_and_outside_baseurl_are_explicit(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            page = root / 'index.html'
            page.write_text('''<html lang="ko"><head><title>예시</title></head><body><main><h1>예시</h1>
              <a href="https://outside.test/">외부</a><a href="https://blog.test/blogger/">범위 밖</a>
              </main></body></html>''', encoding='utf-8')
            (root / 'search.json').write_text('[]', encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, VERIFY_SITE.verify(root, '/blog', 'https://blog.test'))
            self.assertIn('outside-baseurl', output.getvalue())
            self.assertNotIn('https://outside.test/', output.getvalue())
            page.write_text(page.read_text(encoding='utf-8').replace('<a href="https://blog.test/blogger/">범위 밖</a>', ''), encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(0, VERIFY_SITE.verify(root, '/blog', 'https://blog.test'))

    def test_unknown_origin_only_blocks_http_and_protocol_relative_links(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            page = root / 'index.html'
            html = '''<html lang="ko"><head><title>예시</title></head><body><main><h1>예시</h1>
              <a href="ftp://files.example.test/file">FTP</a>
              <a href="obsidian://open?vault=notes">노트</a>
              <a href="mailto:hello@example.test">메일</a>{link}</main></body></html>'''
            (root / 'search.json').write_text('[]', encoding='utf-8')
            page.write_text(html.format(link=''), encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(0, VERIFY_SITE.verify(root))
            for url in ('https://blog.test/missing', 'http://blog.test/missing', '//blog.test/missing'):
                with self.subTest(url=url):
                    page.write_text(html.format(link=f'<a href="{url}">미확인</a>'), encoding='utf-8')
                    output = io.StringIO()
                    with contextlib.redirect_stdout(output):
                        self.assertEqual(1, VERIFY_SITE.verify(root))
                    self.assertIn('cannot determine site origin', output.getvalue())

    def test_cli_rejects_invalid_baseurl_and_origin(self):
        for option, value in (('--baseurl', '//'), ('--baseurl', '/blog//'),
                              ('--baseurl', '/blog/%2e%2e'), ('--baseurl', '/blog?x'),
                              ('--site-origin', 'https://blog.test/blog')):
            with self.subTest(option=option, value=value):
                result = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'verify_site.py'),
                                         option, value], capture_output=True, text=True)
                self.assertNotEqual(0, result.returncode)
                self.assertIn('error:', result.stderr)


class AccessibilityStructureTests(unittest.TestCase):
    def test_accepts_a_named_document_with_one_main_and_one_h1(self):
        html = '''<!doctype html>
<html lang="ko"><head><title>Example</title></head><body>
  <main><h1>Example</h1>
    <label for="query">Search</label><input id="query" type="search">
    <a href="/posts/">Posts</a><button type="button">Reset</button>
    <img src="/assets/example.png" alt="Example diagram">
  </main>
</body></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)

        self.assertEqual([], VERIFY_SITE.accessibility_findings(document, Path('example.html')))

    def test_reports_missing_landmarks_names_and_image_alternatives(self):
        html = '''<html><head><title></title></head><body>
  <h1>First</h1><h1>Second</h1><input type="text">
  <a href="/posts/"><svg aria-hidden="true"></svg></a>
  <button type="button"><svg aria-hidden="true"></svg></button>
  <img src="/assets/decorative.png">
</body></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)

        findings = '\n'.join(VERIFY_SITE.accessibility_findings(document, Path('missing.html')))

        self.assertIn('<html> has no lang', findings)
        self.assertIn('document must have one non-empty title', findings)
        self.assertIn('expected one h1, found 2', findings)
        self.assertIn('expected one main landmark, found 0', findings)
        self.assertIn('input has no accessible name', findings)
        self.assertIn('a[href="/posts/"] has no accessible name', findings)
        self.assertIn('button has no accessible name', findings)
        self.assertIn('img has no alt attribute', findings)

    def test_uses_aria_names_and_wrapped_labels(self):
        html = '''<html lang="en"><head><title>Search</title></head><body>
  <main><h1>Search</h1><input aria-label="Search posts">
    <label>Filter <select><option>All</option></select></label>
    <a href="/posts/" aria-label="Open posts"><svg aria-hidden="true"></svg></a>
    <button aria-labelledby="reset-name"><svg aria-hidden="true"></svg></button>
    <span id="reset-name">Reset</span><img alt="">
  </main></body></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)

        self.assertEqual([], VERIFY_SITE.accessibility_findings(document, Path('named.html')))

    def test_allows_noindex_redirect_stubs_without_a_main_landmark(self):
        html = '''<!doctype html><html lang="en-US"><meta charset="utf-8">
  <title>Redirecting</title><link rel="canonical" href="/posts/one/">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=/posts/one/">
  <h1>Redirecting</h1><a href="/posts/one/">Open the post</a></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)

        self.assertEqual([], VERIFY_SITE.accessibility_findings(document, Path('redirect.html')))

    def test_empty_legacy_name_anchor_is_not_a_link_but_empty_href_is(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body>
          <main><h1>Example</h1><a name="old"></a><a name="real" href=""></a>
          <a name="button" role="button"></a><a name="focusable" tabindex="0"></a>
          </main></body></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)
        findings = VERIFY_SITE.accessibility_findings(document, Path('anchors.html'))
        self.assertEqual(3, len(findings))
        self.assertTrue(all('a[href=""] has no accessible name' in item for item in findings))

    def test_empty_anchors_without_link_behavior_do_not_require_names(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body>
          <main><h1>Example</h1><a id="legacy"></a><a></a><a href=""></a>
          <a id="button" role="button"></a><a id="focusable" tabindex="0"></a><a role=""></a>
          </main></body></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)
        findings = VERIFY_SITE.accessibility_findings(document, Path('anchors.html'))
        self.assertEqual(4, len(findings))
        self.assertTrue(all('a[href=""] has no accessible name' in item for item in findings))

    def test_full_verifier_accepts_empty_id_fragment_anchor(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <a id="legacy"></a><a href="#legacy">이전 문단</a></main></body></html>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text(html, encoding='utf-8')
            (root / 'search.json').write_text('[]', encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(0, VERIFY_SITE.verify(root), output.getvalue())

    def test_empty_id_is_reported_but_missing_id_is_not(self):
        document = VERIFY_SITE.PageParser()
        document.feed('''<html lang="ko"><head><title>Example</title></head><body>
          <main><h1>Example</h1><div></div><p id="">Empty</p><span id>Empty too</span></main>
          </body></html>''')
        findings = VERIFY_SITE.accessibility_findings(document, Path('index.html'))
        self.assertIn('index.html: empty id (2 occurrences)', findings)

    def test_output_for_uses_ascii_separated_ids(self):
        document = VERIFY_SITE.PageParser()
        document.feed('<output for="first\t한\u00a0글">0</output>')
        self.assertIn(('for', 'first', 'output'), document.references)
        self.assertIn(('for', '한\u00a0글', 'output'), document.references)
        self.assertEqual(2, len(document.references))

    def test_invalid_id_whitespace_cannot_create_a_matching_label_or_aria_target(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <label for="foo">Label</label><input id=" foo ">
          <button aria-labelledby="foo">Button</button></main></body></html>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text(html, encoding='utf-8')
            (root / 'search.json').write_text('[]', encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, VERIFY_SITE.verify(root))
            findings = output.getvalue()
            self.assertIn('id contains ASCII whitespace', findings)
            self.assertIn('input has no accessible name', findings)
            self.assertIn("for references missing id 'foo'", findings)
            self.assertIn("aria-labelledby references missing id 'foo'", findings)

    def test_label_for_is_not_trimmed_and_non_ascii_id_spaces_are_preserved(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <label for=" foo ">Wrong label</label><input id="foo">
          <label for="한\u00a0글">Name</label><input id="한\u00a0글">
          <span id="더\u00a0보기">More</span><button aria-labelledby="더\u00a0보기">More</button>
          </main></body></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)
        self.assertIn('input has no accessible name', '\n'.join(VERIFY_SITE.accessibility_findings(document, Path('index.html'))))
        self.assertEqual('한\u00a0글', document.form_controls[1]['id'])
        self.assertIn(('aria-labelledby', '더\u00a0보기', 'button'), document.references)
        self.assertIn(('for', ' foo ', 'label'), document.references)

    def test_non_ascii_whitespace_in_id_is_not_ascii_whitespace(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <label for="한\u00a0글">Name</label><input id="한\u00a0글">
          <span id="더\u00a0보기">More</span><button aria-labelledby="더\u00a0보기">More</button>
          </main></body></html>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text(html, encoding='utf-8')
            (root / 'search.json').write_text('[]', encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(0, VERIFY_SITE.verify(root), output.getvalue())

    def test_template_contents_are_not_part_of_the_document_tree(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <template id="template-host"><h1 id="hidden-id">Not rendered</h1>
            <a name="hidden-name" href="/not-a-page">Hidden link</a><input>
            <template id="hidden-nested"><main id="also-hidden">Nested</main></template>
          </template><h2 id="after">Visible</h2><a href="#after">Go</a>
          </main></body></html>'''
        document = VERIFY_SITE.PageParser()
        document.feed(html)
        document.close()
        self.assertIn('template-host', document.fragment_ids)
        for element_id in ('hidden-id', 'hidden-nested', 'also-hidden'):
            self.assertNotIn(element_id, document.fragment_ids)
        self.assertNotIn('hidden-name', document.fragment_names)
        self.assertIn('after', document.fragment_ids)
        self.assertEqual(1, document.h1_count)
        self.assertEqual(1, document.main_count)
        self.assertNotIn(('href', '/not-a-page'), document.urls)
        self.assertEqual([], VERIFY_SITE.accessibility_findings(document, Path('template.html')))


class FragmentTargetTests(unittest.TestCase):
    def parse(self, html):
        document = VERIFY_SITE.PageParser()
        document.feed(html)
        document.close()
        return document

    def target(self, document, raw_url):
        joined, fragment = VERIFY_SITE.parse_local_url(
            Path('posts/example/index.html'), raw_url, 'https://blog.test'
        )
        self.assertIsNotNone(joined)
        return VERIFY_SITE.fragment_target(document, fragment)

    def test_raw_id_and_name_precede_percent_decoded_id(self):
        document = self.parse('''
          <h2 id="rate%20limit">Raw ID</h2><h2 id="rate limit">Decoded ID</h2>
          <a name="%ED%95%9C">Raw name</a><h2 id="한">Decoded Korean</h2>
          <h2 id="rate%2520limit">Double encoding</h2>
        ''')
        self.assertEqual(('id', 'rate%20limit'), self.target(document, '#rate%20limit'))
        self.assertEqual(('id', 'rate%2520limit'), self.target(document, '#rate%2520limit'))
        self.assertEqual(('name', '%ED%95%9C'), self.target(document, '#%ED%95%9C'))

    def test_fragment_serialization_and_id_values_are_not_trimmed(self):
        document = self.parse('''
          <h2 id="가">Korean</h2><h2 id="%EA%B0%80">Raw escaped ID</h2>
          <h2 id=" a b ">Spaces</h2><h2 id="hash#value">Hash</h2>
        ''')
        self.assertEqual(('id', '%EA%B0%80'), self.target(document, '#가'))
        self.assertEqual(('id', ' a b '), self.target(document, '#%20a%20b%20'))
        self.assertEqual(('id', 'hash#value'), self.target(document, '#hash#value'))
        self.assertEqual(('id', '%EA%B0%80'), self.target(document, '/posts/example/#가'))
        self.assertEqual(('id', '%EA%B0%80'), self.target(document, 'https://blog.test/posts/example/#가'))

    def test_top_fallback_does_not_override_real_targets(self):
        document = self.parse('<h2 id="top">Existing</h2><a name="TOP">Named</a>')
        self.assertEqual(('top', ''), self.target(document, '#'))
        self.assertEqual(('id', 'top'), self.target(document, '#top'))
        self.assertEqual(('name', 'TOP'), self.target(document, '#TOP'))
        self.assertEqual(('id', 'top'), self.target(document, '#%74op'))
        self.assertEqual(('top', ''), self.target(document, '#ToP'))
        self.assertIsNone(self.target(document, '#missing'))

    def test_invalid_escapes_invalid_utf8_and_bom_follow_url_rules(self):
        document = self.parse('<h2 id="bad%2Z">Literal</h2><h2 id="bad�">Invalid</h2><h2 id="\ufeffname">BOM</h2>')
        self.assertEqual(('id', 'bad%2Z'), self.target(document, '#bad%2Z'))
        self.assertEqual(('id', 'bad�'), self.target(document, '#bad%FF'))
        self.assertEqual(('id', '\ufeffname'), self.target(document, '#%EF%BB%BFname'))

    def test_relative_and_absolute_local_targets_keep_fragment_and_path_boundary(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'site'
            (root.parent / 'outside').write_text('outside', encoding='utf-8')
            page = root / 'blog' / 'one' / 'index.html'
            other = root / 'blog' / 'two' / 'index.html'
            page.parent.mkdir(parents=True)
            other.parent.mkdir(parents=True)
            page.write_text('current', encoding='utf-8')
            other.write_text('other', encoding='utf-8')
            (root / 'index.html').write_text('root', encoding='utf-8')
            cases = [
                ('#rate%20limit', page),
                ('../two/#rate%20limit', other),
                ('/blog/two/#rate%20limit', other),
                ('https://blog.test/blog/two/#rate%20limit', other),
                ('https://blog.test#rate%20limit', root / 'index.html'),
                ('//blog.test?x=1#rate%20limit', root / 'index.html'),
            ]
            for url, expected in cases:
                with self.subTest(url=url):
                    target, fragment = VERIFY_SITE.resolve_target(root, page, url, 'https://blog.test')
                    self.assertEqual(expected, target)
                    self.assertEqual('rate%20limit', fragment)
            external, _ = VERIFY_SITE.parse_local_url(Path('blog/one/index.html'), 'https://other.test/blog/two/#x', 'https://blog.test')
            self.assertIsNone(external)
            escaped, _ = VERIFY_SITE.resolve_target(root, page, '/%2e%2e/outside#x', 'https://blog.test')
            self.assertIsNone(escaped)

    def test_same_origin_comparison_handles_url_forms_and_keeps_other_origins_out(self):
        page = Path('blog/one/index.html')
        for url in (
            '//BLOG.TEST/blog/missing#broken',
            '//blog.test:443/blog/missing#broken',
            'https://BLOG.TEST/blog/missing#broken',
            'https://blog.test:443/blog/missing#broken',
        ):
            with self.subTest(url=url):
                joined, fragment = VERIFY_SITE.parse_local_url(page, url, 'https://blog.test')
                self.assertIsNotNone(joined)
                self.assertEqual('/blog/missing', joined.path)
                self.assertEqual('broken', fragment)
        for url in (
            '//other.test/blog/missing#broken',
            'http://blog.test/blog/missing#broken',
            'https://blog.test:444/blog/missing#broken',
            'https://user@blog.test/blog/missing#broken',
            'https://blog.test:notaport/blog/missing#broken',
            'https://blog.test\\.other/blog/missing#broken',
        ):
            with self.subTest(url=url):
                joined, _ = VERIFY_SITE.parse_local_url(page, url, 'https://blog.test')
                self.assertIsNone(joined)
        for url in ('//[::1]:443/blog/missing#x', 'https://[0:0:0:0:0:0:0:1]/blog/missing#x'):
            with self.subTest(url=url):
                joined, fragment = VERIFY_SITE.parse_local_url(page, url, 'https://[::1]')
                self.assertIsNotNone(joined)
                self.assertEqual('x', fragment)

    def test_same_scheme_without_authority_uses_the_current_document_as_base(self):
        page = Path('blog/one/index.html')
        cases = (
            ('https:missing#x', '/blog/one/missing', 'x'),
            ('https:/missing#x', '/missing', 'x'),
            ('https:?q', '/blog/one/index.html', ''),
            ('https:', '/blog/one/index.html', ''),
        )
        for url, expected_path, expected_fragment in cases:
            with self.subTest(url=url):
                joined, fragment = VERIFY_SITE.parse_local_url(page, url, 'https://blog.test')
                self.assertIsNotNone(joined)
                self.assertEqual(expected_path, joined.path)
                self.assertEqual(expected_fragment, fragment)
        external, _ = VERIFY_SITE.parse_local_url(page, 'http:missing#x', 'https://blog.test')
        self.assertIsNone(external)

    def test_backslash_in_local_path_or_ambiguous_authority_is_reported(self):
        for url in (
            r'/blog/one/\missing', r'\missing', r'//blog.test\other/missing',
            r'https://blog.test\@other.test/missing', r'https:\\blog.test\missing',
            r'https://blog.test/blog\missing',
        ):
            with self.subTest(url=url):
                self.assertTrue(VERIFY_SITE.has_ambiguous_backslash(url, 'https://blog.test'))
        for url in (
            r'/blog/one/?next=\folder#part\name',
            r'../two/#part\name',
            r'https://other.test/path\segment?x=y',
            r'mailto:user@example.test?subject=\path',
        ):
            with self.subTest(url=url):
                self.assertFalse(VERIFY_SITE.has_ambiguous_backslash(url, 'https://blog.test'))

    def test_full_verifier_accepts_fragments_and_still_rejects_broken_ones(self):
        html = '''<!doctype html><html lang="ko"><head><title>Example</title></head><body>
          <main><h1>Example</h1><h2 id="rate%20limit">Rate</h2>
          <a name="legacy"></a><a href="#rate%20limit">Rate link</a>
          <a href="#legacy">Legacy link</a><a href="#top">Top link</a></main></body></html>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            page = root / 'index.html'
            page.write_text(html, encoding='utf-8')
            (root / 'search.json').write_text(json.dumps([]), encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(0, VERIFY_SITE.verify(root))
            page.write_text(html.replace('#rate%20limit', '#missing'), encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, VERIFY_SITE.verify(root))
            self.assertIn('targets missing', output.getvalue())

    def test_full_verifier_does_not_resolve_fragments_inside_template(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <template id="template-host"><div id="ghost"></div><a href="/missing">Template</a></template>
          <a href="#template-host">Template element</a><a href="#ghost">Missing target</a>
          </main></body></html>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text(html, encoding='utf-8')
            (root / 'search.json').write_text('[]', encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, VERIFY_SITE.verify(root))
            self.assertIn("'#ghost' targets missing", output.getvalue())
            self.assertNotIn('/missing', output.getvalue())

    def test_full_verifier_rejects_ambiguous_local_backslash_not_fragment_backslash(self):
        html = r'''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <div id="part\name">Target</div><a href="/?next=\folder#part\name">Valid fragment</a>
          <a href="/bad\path">Invalid path</a></main></body></html>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text(html, encoding='utf-8')
            (root / 'search.json').write_text('[]', encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, VERIFY_SITE.verify(root))
            self.assertIn('backslash', output.getvalue())
            self.assertIn('/bad\\path', output.getvalue())
            self.assertNotIn('targets missing', output.getvalue())

    def test_full_verifier_reports_invalid_authority_but_skips_valid_external_url(self):
        html = '''<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1>
          <a href="https://[invalid">Invalid IPv6</a>
          <a href="https://other.test:notaport/path">Invalid port</a>
          <a href="https:///evil.test/missing#x">Ambiguous authority</a>
          <a href="https://other.test/valid">External</a></main></body></html>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text(html, encoding='utf-8')
            (root / 'search.json').write_text('[]', encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, VERIFY_SITE.verify(root, site_origin='https://blog.test'))
            self.assertIn("invalid href URL 'https://[invalid'", output.getvalue())
            self.assertIn("invalid href URL 'https://other.test:notaport/path'", output.getvalue())
            self.assertIn("invalid href URL 'https:///evil.test/missing#x'", output.getvalue())
            self.assertNotIn('https://other.test/valid', output.getvalue())

    def test_search_index_cannot_bypass_shared_url_validation(self):
        html = '<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1></main></body></html>'
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text(html, encoding='utf-8')
            misleading_target = root / 'evil.test' / 'missing' / 'index.html'
            misleading_target.parent.mkdir(parents=True)
            misleading_target.write_text(html, encoding='utf-8')
            (root / 'bad\\path.html').write_text(html, encoding='utf-8')
            for invalid_url in ('https:///evil.test/missing#x', '/bad\\path.html'):
                with self.subTest(url=invalid_url):
                    entries = [
                        {'type': 'post', 'url': 'https://blog.test/', 'title': 'Root', 'content': 'Root'},
                        {'type': 'post', 'url': invalid_url, 'title': 'Invalid', 'content': 'Invalid'},
                    ]
                    (root / 'search.json').write_text(json.dumps(entries), encoding='utf-8')
                    output = io.StringIO()
                    with contextlib.redirect_stdout(output):
                        self.assertEqual(1, VERIFY_SITE.verify(root))
                    self.assertIn('has no generated page', output.getvalue())

    def test_encoded_delimiters_are_path_data_not_query_or_fragment(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            html = '<html lang="ko"><head><title>Example</title></head><body><main><h1>Example</h1></main></body></html>'
            (root / 'index.html').write_text(html, encoding='utf-8')
            paths = ('a?one', 'a?two', 'hash#value', 'percent%value')
            encoded = ('a%3Fone', 'a%3Ftwo', 'hash%23value', 'percent%25value')
            for path in paths:
                output = root / 'blog' / 'posts' / path / 'index.html'
                output.parent.mkdir(parents=True)
                output.write_text(html, encoding='utf-8')
            entries = [
                {'type': 'post', 'url': f'https://blog.test/blog/posts/{path}/?actual=query',
                 'title': f'Post {index}', 'content': '본문'}
                for index, path in enumerate(encoded)
            ]
            (root / 'search.json').write_text(json.dumps(entries), encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(0, VERIFY_SITE.verify(root), output.getvalue())
            page = root / 'index.html'
            normalized = [VERIFY_SITE.normalized_url_path(entry['url'], page, root, 'https://blog.test') for entry in entries]
            self.assertEqual(['/blog/posts/a?one', '/blog/posts/a?two', '/blog/posts/hash#value', '/blog/posts/percent%value'], normalized)
            self.assertEqual('', VERIFY_SITE.normalized_url_path('https://other.test/blog/posts/a%3Fone/', page, root, 'https://blog.test'))

            entries.append({**entries[0], 'url': 'https://blog.test/blog/posts/a%3Fone/?another=query'})
            (root / 'search.json').write_text(json.dumps(entries), encoding='utf-8')
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(1, VERIFY_SITE.verify(root))
            self.assertIn('duplicate URL', output.getvalue())


class HiddenDescendantNameTests(unittest.TestCase):
    def findings(self, content):
        document = VERIFY_SITE.PageParser()
        document.feed(f'''<html lang="ko"><head><title>예시</title></head><body>
          <main><h1>예시</h1>{content}</main></body></html>''')
        document.close()
        return VERIFY_SITE.accessibility_findings(document, Path('hidden-name.html'))

    def test_hidden_descendant_text_and_images_do_not_name_a_control(self):
        findings = self.findings('''
          <button><span aria-hidden="true">메뉴</span></button>
          <a href="/first"><span aria-hidden="true"><img alt="숨긴 그림"></span></a>
          <a href="/second"><img aria-hidden="true" alt="숨긴 그림"></a>
          <button><span aria-hidden="true"><span aria-hidden="false">숨긴 이름</span></span></button>
        ''')
        self.assertEqual(4, len(findings))
        self.assertEqual(2, sum('button has no accessible name' in item for item in findings))
        self.assertEqual(2, sum('a[href=' in item and 'has no accessible name' in item for item in findings))

    def test_visible_content_and_explicit_hidden_label_reference_are_preserved(self):
        findings = self.findings('''
          <button><span aria-hidden="true">꾸밈</span>열기</button>
          <a href="/posts/"><img alt="글 목록"><span aria-hidden="true">장식</span></a>
          <span id="hidden-label" aria-hidden="true">검색</span>
          <button aria-labelledby="hidden-label"><span aria-hidden="true">아이콘</span></button>
        ''')
        self.assertEqual([], findings)

    def test_html_hidden_descendants_do_not_name_visible_controls(self):
        findings = self.findings('''
          <button><span hidden>메뉴</span></button>
          <a href="/hidden-image"><img hidden alt="숨긴 그림"></a>
          <button><span hidden><span aria-hidden="false">숨긴 이름</span></span></button>
        ''')
        self.assertEqual(3, len(findings))
        self.assertEqual(2, sum('button has no accessible name' in item for item in findings))
        self.assertIn('a[href="/hidden-image"] has no accessible name', '\n'.join(findings))

    def test_hidden_controls_are_not_counted_as_accessible_controls(self):
        findings = self.findings('''
          <button aria-hidden="true"><span aria-hidden="true">아이콘</span></button>
          <div aria-hidden="true"><button></button><input></div>
          <div hidden><a href="/hidden"></a><button></button><input></div>
          <button hidden></button><input hidden>
          <button>열기</button>
        ''')
        self.assertEqual([], findings)

    def test_html_hidden_directly_referenced_label_is_preserved(self):
        findings = self.findings('''
          <span id="label" hidden>숨긴 레이블</span>
          <button aria-labelledby="label"><span hidden>아이콘</span></button>
        ''')
        self.assertEqual([], findings)


if __name__ == '__main__':
    unittest.main()
