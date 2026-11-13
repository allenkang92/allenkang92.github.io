import importlib.util
import json
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    "audit_installed_gems", Path(__file__).with_name("audit_installed_gems.py")
)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditInstalledGemsTest(unittest.TestCase):
    def test_installed_packages_rejects_unexpected_sources(self):
        self.assertEqual(
            audit.installed_packages(json.dumps([
                {"name": "foo", "version": "1.0", "source": "Bundler::Source::Rubygems"},
                {"name": "bundler", "version": "2.5.22", "source": "Bundler::Source::Metadata"},
            ])),
            [("bundler", "2.5.22"), ("foo", "1.0")],
        )
        with self.assertRaises(ValueError):
            audit.installed_packages(json.dumps([
                {"name": "foo", "version": "1.0", "source": "Bundler::Source::Git"},
            ]))
        with self.assertRaises(ValueError):
            audit.installed_packages("[]")

    def test_valid_results_preserve_request_order_and_report_matches(self):
        packages = [("alpha", "1.0"), ("beta", "2.0")]
        response = {"results": [{}, {"vulns": [{"id": "GHSA-example", "modified": "2026-01-01"}]}]}
        self.assertEqual(audit.validate_results(response, packages), [("beta", "2.0", "GHSA-example")])

    def test_incomplete_or_unexpected_response_is_not_success(self):
        packages = [("alpha", "1.0")]
        for payload in (
            {}, {"error": "unavailable"}, {"results": []},
            {"results": [{}], "error": "unavailable"},
            {"results": [{"next_page_token": "more"}]},
            {"results": [{"next_page_token": None}]},
            {"results": [{"error": "unavailable"}]},
            {"results": [{"vulns": [{}]}]},
            {"results": [{"vulns": None}]},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                audit.validate_results(payload, packages)


if __name__ == "__main__":
    unittest.main()
