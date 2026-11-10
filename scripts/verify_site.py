#!/usr/bin/env python3
"""Check generated Jekyll pages for accessibility structure, navigation, and search data."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import SplitResult, unquote, urljoin, urlsplit


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


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: Counter[str] = Counter()
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

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value or "" for name, value in attrs}
        attribute_names = {name for name, _value in attrs}
        element_id = values.get("id", "").strip()
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
            self.image_alternatives.append(("alt" in attribute_names, values.get("alt", "").strip() != "", values.get("aria-hidden", "").lower() == "true"))
            for frame in self._stack:
                if frame["tag"] in {"a", "button"} and values.get("alt", "").strip():
                    frame["image_alt"] = f"{frame.get('image_alt', '')} {values['alt'].strip()}"

        label_target = values.get("for", "").strip()
        if tag == "label" and label_target:
            self.label_targets.add(label_target)

        for attribute in ("href", "src", "action", "poster"):
            value = values.get(attribute, "").strip()
            if value:
                self.urls.append((attribute, value))

        if label_target:
            self.references.append(("for", label_target, tag))

        for attribute in REFERENCE_ATTRIBUTES:
            for target in values.get(attribute, "").split():
                self.references.append((attribute, target, tag))

        if tag in {"input", "select", "textarea"} and values.get("type", "").lower() != "hidden" and values.get("aria-hidden", "").lower() != "true":
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
        if tag not in VOID_ELEMENTS:
            self._stack.append(frame)

    def handle_data(self, data: str) -> None:
        for frame in self._stack:
            if frame.get("document_title"):
                frame["text"] = f"{frame.get('text', '')}{data}"
            if "name_text" in frame:
                frame["name_text"] = f"{frame.get('name_text', '')}{data}"

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index]["tag"] != tag:
                continue
            for frame in self._stack[index:]:
                if frame.get("document_title"):
                    self.document_titles.append(str(frame.get("text", "")).strip())
                if frame["tag"] in {"a", "button"}:
                    attrs = frame.get("attrs", {})
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
    path = unquote(value).split("?", 1)[0].rstrip("/")
    return path or "/"


def parse_local_url(page: Path, raw_url: str, site_origin: str) -> tuple[SplitResult | None, str]:
    raw = urlsplit(raw_url)
    if raw.scheme or raw.netloc:
        origin = f"{raw.scheme}://{raw.netloc}" if raw.scheme and raw.netloc else ""
        if origin != site_origin:
            return None, ""
        return raw, unquote(raw.fragment)
    joined = urlsplit(urljoin("/" + page.as_posix(), raw_url))
    return joined, unquote(joined.fragment)


def resolve_target(site_root: Path, page: Path, raw_url: str, site_origin: str) -> tuple[Path | None, str]:
    joined, fragment = parse_local_url(page.relative_to(site_root), raw_url, site_origin)
    if joined is None:
        return None, ""

    relative = unquote(joined.path).lstrip("/")
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


def normalized_url_path(raw_url: str, page: Path, site_root: Path, site_origin: str) -> str:
    joined, _ = parse_local_url(page.relative_to(site_root), raw_url, site_origin)
    if joined is None:
        return ""
    return canonical_path(joined.path)


def read_page(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def verify(site_root: Path) -> int:
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
    first_post_url = next(
        (entry.get("url") for entry in raw_search_entries if entry.get("type") == "post" and isinstance(entry.get("url"), str)),
        "",
    )
    parsed_origin = urlsplit(str(first_post_url))
    site_origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}" if parsed_origin.scheme and parsed_origin.netloc else ""
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
            target, fragment = resolve_target(site_root, page, raw_url, site_origin)
            joined, _ = parse_local_url(page.relative_to(site_root), raw_url, site_origin)
            if joined is None:
                continue
            local_url_count += 1
            if target is None:
                errors.append(f"{relative_page}: broken local {attribute} '{raw_url}'")
                continue
            if fragment:
                fragment_count += 1
                target_document = parsed.get(target)
                if target_document is None:
                    target_document = read_page(target) if target.suffix.lower() == ".html" else None
                    if target_document is not None:
                        parsed[target] = target_document
                if target_document is not None and fragment not in target_document.ids:
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
                normalized = normalized_url_path(url, site_root / "index.html", site_root, site_origin)
                if entry.get("type") == "post" and normalized in seen_urls:
                    errors.append(f"search.json contains duplicate URL '{normalized}'")
                if entry.get("type") == "post":
                    seen_urls.add(normalized)
                if not isinstance(entry.get("title"), str) or not entry["title"].strip():
                    errors.append(f"search.json entry '{normalized}' has no title")
                if entry.get("type") == "post" and (not isinstance(entry.get("content"), str) or not entry["content"].strip()):
                    errors.append(f"search.json entry '{normalized}' has no searchable content")
                target, _ = resolve_target(site_root, site_root / "index.html", url, site_origin)
                if target is None:
                    errors.append(f"search.json URL '{normalized}' has no generated page")

            posts_page = site_root / "posts" / "index.html"
            if posts_page.is_file():
                archive_urls = {
                    normalized_url_path(value, posts_page, site_root, site_origin)
                    for attribute, value in parsed.get(posts_page, read_page(posts_page)).urls
                    if attribute == "href"
                    and normalized_url_path(value, posts_page, site_root, site_origin).startswith("/posts/")
                    and normalized_url_path(value, posts_page, site_root, site_origin) != "/posts/index.html"
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
        f"{len(search_entries)} search entries; semantic landmarks, accessible names, image alternatives, "
        "IDs, and ARIA/label references are valid"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", type=Path, default=Path("_site"), help="Jekyll output directory (default: _site)")
    args = parser.parse_args()
    site_root = args.site_dir.resolve()
    if not site_root.is_dir():
        print(f"FAIL: generated site directory does not exist: {site_root}")
        return 1
    return verify(site_root)


if __name__ == "__main__":
    sys.exit(main())
