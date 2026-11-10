import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('verify_site', ROOT / 'scripts' / 'verify_site.py')
VERIFY_SITE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY_SITE)


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


if __name__ == '__main__':
    unittest.main()
