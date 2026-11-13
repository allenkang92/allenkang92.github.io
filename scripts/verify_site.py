#!/usr/bin/env python3
"""Check generated Jekyll pages for accessibility structure, navigation, and search data."""

from __future__ import annotations

import argparse
import ipaddress
import posixpath
import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import SplitResult, quote, unquote, urljoin, urlsplit


REFERENCE_ATTRIBUTES = (
    "aria-controls",
    "aria-describedby",
    "aria-details",
    "aria-flowto",
    "aria-labelledby",
    "aria-owns",
    "aria-activedescendant",
)
VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
    "param", "source", "track", "wbr",
}
# WHATWG URL fragment serialization percent-encodes controls, non-ASCII,
# space, double quote, <, > and backtick; existing percent escapes stay intact.
FRAGMENT_SAFE = "".join(chr(code) for code in range(0x21, 0x7F) if chr(code) not in '\"<>`')
ASCII_WHITESPACE = "\t\n\f\r "


def statically_hidden(attrs: dict[str, str]) -> bool:
    # This is a markup-only approximation. CSS can override HTML hidden and
    # JavaScript can change either attribute after the document is parsed.
    return "hidden" in attrs or attrs.get("aria-hidden", "").strip().lower() == "true"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: Counter[str] = Counter()
        self.empty_id_count = 0
        self.fragment_ids: set[str] = set()
        self.fragment_names: set[str] = set()
        self.urls: list[tuple[str, str]] = []
        self.references: list[tuple[str, str, str]] = []
        self.html_lang = ""
        self.document_titles: list[str] = []
        self.h1_count = 0
        self.main_count = 0
        self.noindex = False
        self.has_meta_refresh = False
        self.has_canonical = False
        self.image_alternatives: list[tuple[bool, bool, str]] = []
        self.label_targets: set[str] = set()
        self.form_controls: list[dict[str, str | bool]] = []
        self.named_elements: list[dict[str, str]] = []
        self._stack: list[dict[str, object]] = []
        self._template_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # The template element itself is in the document, but its content is
        # stored in a separate fragment rather than the document tree.
        if self._template_depth:
            if tag == "template":
                self._template_depth += 1
            return
        values = {name: value or "" for name, value in attrs}
        attribute_names = {name for name, _value in attrs}
        hidden_for_name = statically_hidden(values) or any(
            statically_hidden(ancestor.get("attrs", {})) for ancestor in self._stack
        )
        raw_id = values.get("id", "")
        if "id" in attribute_names and not raw_id:
            self.empty_id_count += 1
        if raw_id:
            self.fragment_ids.add(raw_id)
        if tag == "a" and values.get("name", ""):
            self.fragment_names.add(values["name"])
        # IDs are exact strings. Trimming invents an ID that the DOM does not have.
        element_id = raw_id
        if element_id:
            self.ids[element_id] += 1

        if tag == "html":
            self.html_lang = values.get("lang", "").strip()
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "main":
            self.main_count += 1
        elif tag == "title" and not any(frame["tag"] == "svg" for frame in self._stack):
            self._stack.append({"tag": tag, "document_title": True, "text": ""})
            return

        if tag == "meta":
            meta_name = values.get("name", "").strip().lower()
            meta_content = values.get("content", "").strip().lower()
            if meta_name == "robots" and "noindex" in {part.strip() for part in meta_content.split(",")}:
                self.noindex = True
            if values.get("http-equiv", "").strip().lower() == "refresh":
                self.has_meta_refresh = True
        if tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.has_canonical = True

        if tag == "img":
            self.image_alternatives.append(("alt" in attribute_names, values.get("alt", "").strip() != "", hidden_for_name))
            hidden_image = statically_hidden(values)
            for index, frame in enumerate(self._stack):
                hidden_ancestor = any(
                    statically_hidden(ancestor.get("attrs", {}))
                    for ancestor in self._stack[index + 1:]
                )
                if (frame["tag"] in {"a", "button"} and values.get("alt", "").strip()
                        and not hidden_image and not hidden_ancestor):
                    frame["image_alt"] = f"{frame.get('image_alt', '')} {values['alt'].strip()}"

        label_target = values.get("for", "")
        if tag == "label" and label_target:
            self.label_targets.add(label_target)

        for attribute in ("href", "src", "action", "poster"):
            value = values.get(attribute, "").strip()
            if value:
                self.urls.append((attribute, value))

        if tag == "label" and label_target:
            self.references.append(("for", label_target, tag))
        elif tag == "output":
            for target in filter(None, re.split(r"[\t\n\f\r ]+", label_target)):
                self.references.append(("for", target, tag))

        for attribute in REFERENCE_ATTRIBUTES:
            for target in filter(None, re.split(r"[\t\n\f\r ]+", values.get(attribute, ""))):
                self.references.append((attribute, target, tag))

        if tag in {"input", "select", "textarea"} and values.get("type", "").lower() != "hidden" and not hidden_for_name:
            self.form_controls.append({
                "tag": tag,
                "id": element_id,
                "aria_label": values.get("aria-label", "").strip(),
                "aria_labelledby": values.get("aria-labelledby", "").strip(),
                "title": values.get("title", "").strip(),
                "implicit_label": any(frame["tag"] == "label" for frame in self._stack),
            })

        frame: dict[str, object] = {"tag": tag, "attrs": values}
        if tag in {"a", "button"}:
            frame["name_text"] = ""
            frame["image_alt"] = ""
            frame["hidden_for_name"] = hidden_for_name
        if tag not in VOID_ELEMENTS:
            self._stack.append(frame)
        if tag == "template":
            self._template_depth = 1

    def handle_data(self, data: str) -> None:
        if self._template_depth:
            return
        for index, frame in enumerate(self._stack):
            if frame.get("document_title"):
                frame["text"] = f"{frame.get('text', '')}{data}"
            if "name_text" in frame:
                hidden_descendant = any(
                    statically_hidden(descendant.get("attrs", {}))
                    for descendant in self._stack[index + 1:]
                )
                if not hidden_descendant:
                    frame["name_text"] = f"{frame.get('name_text', '')}{data}"

    def handle_endtag(self, tag: str) -> None:
        if self._template_depth:
            if tag != "template":
                return
            self._template_depth -= 1
            if self._template_depth:
                return
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index]["tag"] != tag:
                continue
            for frame in self._stack[index:]:
                if frame.get("document_title"):
                    self.document_titles.append(str(frame.get("text", "")).strip())
                if frame["tag"] in {"a", "button"}:
                    attrs = frame.get("attrs", {})
                    if frame.get("hidden_for_name"):
                        continue
                    # Anchors without href are not links. Keep checking href=""
                    # and elements explicitly given a role or tabindex.
                    if (frame["tag"] == "a" and "href" not in attrs
                            and "role" not in attrs and "tabindex" not in attrs):
                        continue
                    self.named_elements.append({
                        "tag": str(frame["tag"]),
                        "href": str(attrs.get("href", "")),
                        "has_name": bool(
                            str(frame.get("name_text", "")).strip()
                            or str(frame.get("image_alt", "")).strip()
                            or str(attrs.get("aria-label", "")).strip()
                            or str(attrs.get("aria-labelledby", "")).strip()
                            or str(attrs.get("title", "")).strip()
                        ),
                    })
            self._stack = self._stack[:index]
            return

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)


def accessibility_findings(document: PageParser, relative_page: Path) -> list[str]:
    findings: list[str] = []
    page = relative_page.as_posix()
    if not document.html_lang:
        findings.append(f"{page}: <html> has no lang")
    if len(document.document_titles) != 1 or not document.document_titles[0]:
        findings.append(f"{page}: document must have one non-empty title")
    if document.h1_count != 1:
        findings.append(f"{page}: expected one h1, found {document.h1_count}")
    is_redirect_stub = document.noindex and document.has_meta_refresh and document.has_canonical
    if not is_redirect_stub and document.main_count != 1:
        findings.append(f"{page}: expected one main landmark, found {document.main_count}")

    for has_alt, has_text, aria_hidden in document.image_alternatives:
        if not has_alt and not aria_hidden:
            findings.append(f"{page}: img has no alt attribute")

    if document.empty_id_count:
        findings.append(f"{page}: empty id ({document.empty_id_count} occurrences)")
    for element_id in document.ids:
        if any(character in ASCII_WHITESPACE for character in element_id):
            findings.append(f"{page}: id contains ASCII whitespace: {element_id!r}")

    for control in document.form_controls:
        control_id = str(control["id"])
        has_name = bool(
            control["aria_label"]
            or control["aria_labelledby"]
            or control["title"]
            or control["implicit_label"]
            or (control_id and control_id in document.label_targets)
        )
        if not has_name:
            findings.append(f"{page}: {control['tag']} has no accessible name")

    for element in document.named_elements:
        if element["has_name"]:
            continue
        target = f"[href=\"{element['href']}\"]" if element["tag"] == "a" else ""
        findings.append(f"{page}: {element['tag']}{target} has no accessible name")

    return findings


def canonical_path(value: str) -> str:
    # The caller passes urlsplit().path, where the actual query is already
    # separated. A decoded %3F belongs to the filename, not to the query.
    path = unquote(value).rstrip("/")
    return path or "/"


def http_origin(url: SplitResult) -> tuple[str, str, int] | None:
    """Compare HTTP origins without accepting credentials or malformed ports."""
    try:
        scheme = url.scheme.lower()
        if scheme not in {"http", "https"} or not url.netloc or "\\" in url.netloc:
            return None
        if url.username is not None or url.password is not None:
            return None
        host = url.hostname
        port = url.port
        if not host or any(char.isspace() or char in "#/%?\\@" for char in host):
            return None
        try:
            host = ipaddress.ip_address(host).compressed
        except ValueError:
            # Do not approximate browser IDNA or nonstandard IPv4 parsing;
            # compare the hostname spelling conservatively instead.
            host = host.lower()
        return scheme, host, port if port is not None else (443 if scheme == "https" else 80)
    except ValueError:
        return None


def has_ambiguous_backslash(raw_url: str, site_origin: str) -> bool:
    """Reject special-URL path/authority backslashes instead of misresolving them."""
    try:
        raw = urlsplit(raw_url)
        if raw.scheme and raw.scheme.lower() not in {"http", "https"}:
            return False
        if "\\" in raw.netloc:
            return True
        if "\\" not in raw.path:
            return False
        if not raw.netloc:
            return True
        expected = http_origin(urlsplit(site_origin))
        candidate = urlsplit(urljoin(site_origin, raw_url))
        return expected is not None and http_origin(candidate) == expected
    except ValueError:
        return False


def has_invalid_url_authority(raw_url: str) -> bool:
    """Do not silently treat an unparsable authority as an external URL."""
    try:
        raw = urlsplit(raw_url)
        if raw.netloc:
            # Accessors validate bracketed IPv6 and port ranges/syntax.
            _ = raw.hostname, raw.port
        elif raw.scheme.lower() in {"http", "https"}:
            # With three or more slashes, browsers may treat the following
            # component as an authority while urllib treats it as a path.
            cleaned = raw_url.strip("\x00\t\n\r ").replace("\t", "").replace("\n", "").replace("\r", "")
            if cleaned.split(":", 1)[-1].startswith("//"):
                return True
        return False
    except ValueError:
        return True


def parse_local_url(page: Path, raw_url: str, site_origin: str, baseurl: str = "") -> tuple[SplitResult | None, str]:
    # All callers, including search.json checks, share the same rejection
    # boundary used by HTML link checks.
    if has_invalid_url_authority(raw_url) or has_ambiguous_backslash(raw_url, site_origin):
        return None, ""
    try:
        raw = urlsplit(raw_url)
        if raw.scheme or raw.netloc:
            expected = http_origin(urlsplit(site_origin))
            document_base = urljoin(site_origin.rstrip("/") + "/", baseurl + "/" + page.as_posix())
            joined = urlsplit(urljoin(document_base, raw_url))
            if expected is None or http_origin(joined) != expected:
                return None, ""
            if not joined.path:
                # HTTP(S) authority-only URLs navigate to /, not the document.
                joined = joined._replace(path="/")
            return joined, quote(joined.fragment, safe=FRAGMENT_SAFE)
        joined = urlsplit(urljoin(baseurl + "/" + page.as_posix(), raw_url))
        return joined, quote(joined.fragment, safe=FRAGMENT_SAFE)
    except ValueError:
        # Invalid IPv6 literals and ports are not usable local links.
        return None, ""


def fragment_target(document: PageParser, fragment: str) -> tuple[str, str] | None:
    """Resolve a serialized fragment in the HTML indicated-element order."""
    if not fragment:
        return "top", ""

    def lookup(value: str) -> tuple[str, str] | None:
        if value in document.fragment_ids:
            return "id", value
        if value in document.fragment_names:
            return "name", value
        return None

    target = lookup(fragment)
    if target:
        return target
    # URL percent decoding followed by UTF-8 decode without BOM; Python's
    # default replacement mode preserves the BOM and replaces invalid bytes.
    decoded = unquote(fragment, encoding="utf-8", errors="replace")
    target = lookup(decoded)
    if target:
        return target
    if decoded.isascii() and decoded.lower() == "top":
        return "top", ""
    return None


def resolve_target(site_root: Path, page: Path, raw_url: str, site_origin: str, baseurl: str = "") -> tuple[Path | None, str]:
    joined, fragment = parse_local_url(page.relative_to(site_root), raw_url, site_origin, baseurl)
    if joined is None:
        return None, ""

    decoded_path = unquote(joined.path)
    if baseurl:
        # urljoin already normalizes literal dot segments. Check the decoded
        # remainder for encoded traversal before resolving the output path.
        if decoded_path != baseurl and not decoded_path.startswith(baseurl + "/"):
            return None, fragment
        depth = 0
        for component in decoded_path[len(baseurl):].split("/"):
            if component == "..":
                depth -= 1
                if depth < 0:
                    return None, fragment
            elif component not in {"", "."}:
                depth += 1
        normalized_path = posixpath.normpath(decoded_path)
        if normalized_path != baseurl and not normalized_path.startswith(baseurl + "/"):
            return None, fragment
        relative = normalized_path[len(baseurl):].lstrip("/")
    else:
        relative = decoded_path.lstrip("/")
    candidate = site_root / relative if joined.path else page
    if joined.path == "/":
        candidate = site_root
    if candidate.is_dir() or joined.path.endswith("/"):
        candidates = [candidate / "index.html"]
    else:
        candidates = [candidate, candidate.with_name(candidate.name + ".html"), candidate / "index.html"]

    for target in candidates:
        try:
            target.resolve().relative_to(site_root.resolve())
        except ValueError:
            continue
        if target.is_file():
            return target, fragment
    return None, fragment


def normalized_url_path(raw_url: str, page: Path, site_root: Path, site_origin: str, baseurl: str = "") -> str:
    joined, _ = parse_local_url(page.relative_to(site_root), raw_url, site_origin, baseurl)
    if joined is None:
        return ""
    return canonical_path(joined.path)


def read_page(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def verify(site_root: Path, baseurl: str = "", site_origin: str = "") -> int:
    errors: list[str] = []
    pages = sorted(site_root.rglob("*.html"))
    if not pages:
        print(f"FAIL: no generated HTML found in {site_root}")
        return 1

    parsed: dict[Path, PageParser] = {}
    search_path = site_root / "search.json"
    raw_search_entries: list[dict[str, object]] = []
    if search_path.is_file():
        try:
            data = json.loads(search_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                raw_search_entries = [entry for entry in data if isinstance(entry, dict)]
        except (OSError, json.JSONDecodeError):
            pass
    if not site_origin:
        for entry in raw_search_entries:
            if entry.get("type") != "post" or not isinstance(entry.get("url"), str):
                continue
            try:
                parsed_origin = urlsplit(entry["url"])
                if http_origin(parsed_origin):
                    site_origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}"
                    break
            except ValueError:
                continue
    local_url_count = 0
    fragment_count = 0
    for page in pages:
        document = read_page(page)
        parsed[page] = document
        relative_page = page.relative_to(site_root).as_posix()
        errors.extend(accessibility_findings(document, Path(relative_page)))

        for element_id, count in document.ids.items():
            if count > 1:
                errors.append(f"{relative_page}: duplicate id '{element_id}' ({count} occurrences)")

        for attribute, target_id, tag in document.references:
            if target_id not in document.ids:
                errors.append(f"{relative_page}: <{tag}> {attribute} references missing id '{target_id}'")

        for attribute, raw_url in document.urls:
            if has_invalid_url_authority(raw_url):
                errors.append(f"{relative_page}: invalid {attribute} URL '{raw_url}'")
                continue
            if has_ambiguous_backslash(raw_url, site_origin):
                errors.append(f"{relative_page}: {attribute} URL has a backslash in its path or authority '{raw_url}'")
                continue
            if not site_origin:
                raw = urlsplit(raw_url)
                if raw.scheme.lower() in {"http", "https"} or (not raw.scheme and raw.netloc):
                    errors.append(f"{relative_page}: cannot determine site origin to verify {attribute} '{raw_url}' (use --site-origin)")
                    continue
            target, fragment = resolve_target(site_root, page, raw_url, site_origin, baseurl)
            joined, _ = parse_local_url(page.relative_to(site_root), raw_url, site_origin, baseurl)
            if joined is None:
                continue
            local_url_count += 1
            if target is None:
                errors.append(f"{relative_page}: broken or outside-baseurl local {attribute} '{raw_url}'")
                continue
            if fragment:
                fragment_count += 1
                target_document = parsed.get(target)
                if target_document is None:
                    target_document = read_page(target) if target.suffix.lower() == ".html" else None
                    if target_document is not None:
                        parsed[target] = target_document
                if target_document is not None and fragment_target(target_document, fragment) is None:
                    errors.append(f"{relative_page}: {attribute} '{raw_url}' targets missing id '{fragment}'")

    search_entries: list[dict[str, object]] = []
    if not search_path.is_file():
        errors.append("search.json is missing from the generated site")
    else:
        try:
            data = json.loads(search_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"search.json is invalid: {error}")
            data = []
        if not isinstance(data, list):
            errors.append("search.json must contain an array")
        else:
            search_entries = [entry for entry in data if isinstance(entry, dict)]
            if len(search_entries) != len(data):
                errors.append("search.json contains a non-object entry")

            seen_urls: set[str] = set()
            post_entries = [entry for entry in search_entries if entry.get("type") == "post"]
            for index, entry in enumerate(search_entries):
                url = entry.get("url")
                if not isinstance(url, str) or not url.strip():
                    errors.append(f"search.json entry {index + 1} has no URL")
                    continue
                normalized = normalized_url_path(url, site_root / "index.html", site_root, site_origin, baseurl)
                if entry.get("type") == "post" and normalized in seen_urls:
                    errors.append(f"search.json contains duplicate URL '{normalized}'")
                if entry.get("type") == "post":
                    seen_urls.add(normalized)
                if not isinstance(entry.get("title"), str) or not entry["title"].strip():
                    errors.append(f"search.json entry '{normalized}' has no title")
                if entry.get("type") == "post" and (not isinstance(entry.get("content"), str) or not entry["content"].strip()):
                    errors.append(f"search.json entry '{normalized}' has no searchable content")
                target, _ = resolve_target(site_root, site_root / "index.html", url, site_origin, baseurl)
                if target is None:
                    errors.append(f"search.json URL '{normalized}' has no generated page")

            posts_page = site_root / "posts" / "index.html"
            if posts_page.is_file():
                archive_urls = {
                    normalized_url_path(value, posts_page, site_root, site_origin, baseurl)
                    for attribute, value in parsed.get(posts_page, read_page(posts_page)).urls
                    if attribute == "href"
                    and normalized_url_path(value, posts_page, site_root, site_origin, baseurl).startswith(baseurl + "/posts/")
                    and normalized_url_path(value, posts_page, site_root, site_origin, baseurl) != baseurl + "/posts/index.html"
                }
                if archive_urls != seen_urls:
                    missing_from_archive = sorted(seen_urls - archive_urls)
                    missing_from_index = sorted(archive_urls - seen_urls)
                    errors.append(
                        "posts archive and search index differ "
                        f"(archive missing: {missing_from_archive}; index missing: {missing_from_index})"
                    )
            if len(post_entries) != len(seen_urls):
                errors.append(f"search.json has {len(post_entries)} post entries but {len(seen_urls)} unique post URLs")

    if errors:
        print(f"FAIL: {len(errors)} issue(s) across {len(pages)} generated HTML pages")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "PASS: "
        f"{len(pages)} HTML pages, {local_url_count} local URLs, {fragment_count} fragments, "
        f"{len(search_entries)} search entries; basic static checks for landmarks, names, image alternatives, "
        "IDs, and ARIA/label references passed (not a full accessibility audit)"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", type=Path, default=Path("_site"), help="Jekyll output directory (default: _site)")
    parser.add_argument("--baseurl", default="", help="deployment path prefix, e.g. /blog (default: root)")
    parser.add_argument("--site-origin", default="", help="HTTP(S) origin, needed when it cannot be inferred from search.json")
    args = parser.parse_args()
    baseurl = args.baseurl[:-1] if args.baseurl.endswith("/") else args.baseurl
    if args.baseurl.startswith("//") or (baseurl and (not baseurl.startswith("/") or
                    any(part in {"", ".", ".."} for part in baseurl[1:].split("/")) or
                    any(char in baseurl for char in "%?#\\") or any(char.isspace() for char in baseurl))):
        parser.error("--baseurl must be an absolute URL path without escapes, query, fragment or dot segments")
    if args.site_origin:
        try:
            origin = urlsplit(args.site_origin)
            valid_origin = http_origin(origin) and origin.path in {"", "/"} and not origin.query and not origin.fragment
        except ValueError:
            valid_origin = False
        if not valid_origin:
            parser.error("--site-origin must be an HTTP(S) origin without a path, query or fragment")
    site_root = args.site_dir.resolve()
    if not site_root.is_dir():
        print(f"FAIL: generated site directory does not exist: {site_root}")
        return 1
    return verify(site_root, baseurl, args.site_origin)


if __name__ == "__main__":
    sys.exit(main())
