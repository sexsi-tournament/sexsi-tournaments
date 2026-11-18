#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
errors = []

class PageParser(HTMLParser):
    def __init__(self, page):
        super().__init__(convert_charrefs=True)
        self.page = page
        self.ids = set()
        self.script_src = None
        self.script_type = ""
        self.script_parts = []
        self.inline_scripts = []
        self.local_refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            value = attrs["id"]
            if value in self.ids:
                errors.append(f"{self.page}: duplicate id '{value}'")
            self.ids.add(value)

        for attr in ("href", "src"):
            value = attrs.get(attr)
            if not value:
                continue
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc or value.startswith("#"):
                continue
            path = parsed.path
            if path:
                self.local_refs.append(path)

        if tag.lower() == "script":
            self.script_src = attrs.get("src")
            self.script_type = attrs.get("type", "").lower()
            self.script_parts = []

    def handle_data(self, data):
        if self.script_src is not None and self.script_type != "application/ld+json":
            self.script_parts.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "script" and self.script_src is not None:
            if not self.script_src and self.script_type != "application/ld+json":
                code = "".join(self.script_parts).strip()
                if code:
                    self.inline_scripts.append(code)
            self.script_src = None
            self.script_type = ""
            self.script_parts = []

html_files = sorted(ROOT.glob("*.html"))
if not html_files:
    errors.append("No HTML pages found.")

for page in html_files:
    rel = page.relative_to(ROOT)
    parser = PageParser(rel.as_posix())
    parser.feed(page.read_text(encoding="utf-8"))

    for ref in parser.local_refs:
        target = (page.parent / ref).resolve()
        if not target.exists():
            errors.append(f"{rel}: missing local reference '{ref}'")

    for index, code in enumerate(parser.inline_scripts, start=1):
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as tmp:
            tmp.write(code)
            tmp.flush()
            result = subprocess.run(
                ["node", "--check", tmp.name],
                capture_output=True,
                text=True,
            )
            if result.returncode:
                errors.append(f"{rel}: inline script {index} syntax error: {result.stderr.strip()}")

for js_file in ROOT.glob("*.js"):
    result = subprocess.run(
        ["node", "--check", str(js_file)],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        errors.append(f"{js_file.name}: syntax error: {result.stderr.strip()}")

sitemap = ROOT / "sitemap.xml"
if sitemap.exists():
    try:
        ET.parse(sitemap)
    except ET.ParseError as exc:
        errors.append(f"sitemap.xml: invalid XML: {exc}")

if errors:
    print("Site checks failed:")
    for error in errors:
        print(" - " + error)
    raise SystemExit(1)

print(f"Site checks passed: {len(html_files)} HTML pages, local references, inline scripts, JS files and sitemap.")
