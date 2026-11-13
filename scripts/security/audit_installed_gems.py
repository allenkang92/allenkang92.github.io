#!/usr/bin/env python3
"""설치된 후보 Bundler 명세를 OSV RubyGems 버전과 비교한다.

이 결과는 네이티브 라이브러리, 실제 실행 경로 또는 전체 보안 검증이 아니다.
OSV로 패키지 이름과 버전만 전송하며 토큰과 소스 코드는 전송하지 않는다.
"""

import json
import re
import subprocess
import sys
import urllib.request


OSV_URL = "https://api.osv.dev/v1/querybatch"
RUBY_SPEC_QUERY = r'''puts JSON.generate(Bundler.load.specs.map { |s|
  { name: s.name, version: s.version.to_s, source: s.source.class.name }
})'''
NAME_PATTERN = re.compile(r"\A[a-zA-Z0-9][a-zA-Z0-9_.-]*\Z")


def installed_packages(output):
    entries = json.loads(output)
    if not isinstance(entries, list) or not entries:
        raise ValueError("설치된 Bundler 명세가 비어 있거나 형식이 다릅니다.")
    packages = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("패키지 명세가 객체가 아닙니다.")
        name, version, source = entry.get("name"), entry.get("version"), entry.get("source")
        if not isinstance(name, str) or not NAME_PATTERN.fullmatch(name):
            raise ValueError("패키지 이름이 유효하지 않습니다.")
        if not isinstance(version, str) or not version or len(version) > 128:
            raise ValueError("패키지 버전이 유효하지 않습니다.")
        if source != "Bundler::Source::Rubygems" and not (
            name == "bundler" and source == "Bundler::Source::Metadata"
        ):
            raise ValueError(f"RubyGems 외의 출처를 자동으로 검사할 수 없습니다: {name}")
        packages.add((name, version))
    return sorted(packages)


def validate_results(payload, packages):
    if not isinstance(payload, dict) or set(payload) != {"results"}:
        raise ValueError("OSV 응답에 results 외 필드가 있거나 응답 형식이 다릅니다.")
    results = payload["results"]
    if not isinstance(results, list) or len(results) != len(packages):
        raise ValueError("OSV 응답 개수가 요청 개수와 다릅니다.")
    matches = []
    for package, result in zip(packages, results):
        if not isinstance(result, dict) or set(result) - {"vulns", "next_page_token"}:
            raise ValueError("OSV 개별 응답 형식을 확인할 수 없습니다.")
        page_token = result.get("next_page_token", "")
        if not isinstance(page_token, str):
            raise ValueError("OSV 페이지 토큰 형식이 다릅니다.")
        if page_token:
            raise ValueError("OSV 결과가 여러 페이지여서 전체 검사로 판정할 수 없습니다.")
        vulns = result.get("vulns", [])
        if not isinstance(vulns, list):
            raise ValueError("OSV 권고 목록 형식이 다릅니다.")
        for vuln in vulns:
            if not isinstance(vuln, dict) or not isinstance(vuln.get("id"), str) or not vuln["id"]:
                raise ValueError("OSV 권고 식별자가 없습니다.")
            matches.append((package[0], package[1], vuln["id"]))
    return matches


def main():
    result = subprocess.run(
        ["bundle", "exec", "ruby", "-rbundler", "-rjson", "-e", RUBY_SPEC_QUERY],
        check=True, capture_output=True, text=True, timeout=30,
    )
    packages = installed_packages(result.stdout)
    queries = [{"package": {"name": name, "ecosystem": "RubyGems"}, "version": version}
               for name, version in packages]
    request = urllib.request.Request(
        OSV_URL, data=json.dumps({"queries": queries}).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise ValueError(f"OSV HTTP 오류: {response.status}")
        body = response.read(4_000_001)
        if len(body) > 4_000_000:
            raise ValueError("OSV 응답이 예상 크기를 초과했습니다.")
    matches = validate_results(json.loads(body), packages)
    print(f"설치된 RubyGems/Bundler {len(packages)}개 이름·버전의 OSV 결과: {len(matches)}건")
    for name, version, advisory in matches:
        print(f"{name} {version}: {advisory}")
    print("네이티브 라이브러리·취약 코드 실행 여부·공개 Pages 빌드는 이 조회 범위 밖입니다.")
    return 1 if matches else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, subprocess.SubprocessError, ValueError, TypeError) as error:
        print(f"OSV 검사를 완료하지 못했습니다: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(2)
