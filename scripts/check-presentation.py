"""TASK-034 source/PDF preservation checks; no network, credentials or application access."""
from collections import Counter
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = "6494881a82d18ca975bbc09fef6af87f81bb0c57"
OUT = ROOT / "docs/evidence/product-presentation-2026-11-18"


def original(name):
    return subprocess.check_output(["git", "show", f"{BASE}:{name}"], cwd=ROOT)


def links(text, name):
    if name.endswith(".md"):
        return Counter(re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", text))
    return Counter(a or b or c for a, b, c in re.findall(
        r'''href\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]+)\})''', text))


def source(output="source-preservation.json"):
    names = subprocess.check_output(["git", "diff", BASE, "--name-only"], cwd=ROOT, text=True).splitlines()
    forbidden = ("fmd/", "IDEA.md", "context.md", "package.json", "pnpm-lock.yaml", "src/server/",
                 "apps/server/", "packages/", "deployment/")
    checked = []
    for name in names:
        assert not name.startswith(forbidden), f"Out-of-scope change: {name}"
        assert not name.startswith("docs/evidence/") or name.startswith("docs/evidence/product-presentation-2026-11-18/"), name
        if name.endswith((".tsx", ".ts", ".md", ".html")):
            previous = subprocess.run(["git", "show", f"{BASE}:{name}"], cwd=ROOT, capture_output=True)
            before = previous.stdout.decode("utf-8-sig") if previous.returncode == 0 else ""
            after = (ROOT / name).read_text(encoding="utf-8-sig")
            lost = links(before, name) - links(after, name)
            assert not lost, f"Existing links removed in {name}: {dict(lost)}"
            if name.endswith(".tsx") or name.endswith(".html"):
                ids = set(re.findall(r'\bid="([^"]+)"', before))
                assert ids <= set(re.findall(r'\bid="([^"]+)"', after)), f"Anchor removed: {name}"
            checked.append({"path": name, "preservedLinks": sum(links(before, name).values())})
    proof = "apps/web/src/lib/public-proof.ts"
    before = original(proof).decode().replace("\r\n", "\n")
    after = (ROOT / proof).read_text(encoding="utf-8")
    strip_label = lambda text: re.sub(r"  label: .*\n", "", text)
    assert strip_label(before) == strip_label(after), "PUBLIC_PROOF changed beyond its display label"
    for name in ("docs/DECISION-LEDGER.md", "docs/run-evidence.jsonl"):
        assert (ROOT / name).read_bytes().replace(b"\r\n", b"\n").startswith(original(name).replace(b"\r\n", b"\n")), f"History rewritten: {name}"
    plan = (ROOT / "docs/implementation-plan.md").read_text(encoding="utf-8")
    for row in original("docs/implementation-plan.md").decode().splitlines():
        if row.startswith("| TASK-"):
            assert row in plan, "Existing task row changed"
    result = {"status": "passed", "scope": "source/link/anchor/history preservation", "baseline": BASE,
              "checked": checked, "publicProofFinancialValuesUnchanged": True,
              "existingTaskRowsUnchanged": True, "financialActions": 0}
    (OUT / output).write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"status": "passed", "sourceFiles": len(checked), "preservedLinks": sum(x["preservedLinks"] for x in checked)}))


def pdf():
    import fitz
    name = "docs/submission/AegisPay-pitch-draft.pdf"
    data = (ROOT / name).read_bytes()
    doc = fitz.open(stream=data, filetype="pdf")
    old = fitz.open(stream=original(name), filetype="pdf")
    assert len(doc) == 8
    all_text = "\n".join(page.get_text() for page in doc)
    assert "Three-minute Q" not in all_text and "0:00–0:25" not in all_text, "Presenter content leaked into PDF"
    assert "full purchasing agent unfinished" not in all_text
    assert "Gemini bought and read QuickSignal" in all_text
    links_of = lambda d: Counter(link["uri"] for page in d for link in page.get_links() if "uri" in link)
    targets = links_of(doc)
    assert not links_of(old) - targets, "Historical PDF link removed"
    assert all(link.startswith("https://") for link in targets)
    pages = []
    for i, page in enumerate(doc):
        assert tuple(page.rect) == (0.0, 0.0, 960.0, 540.0)
        spans = [span for block in page.get_text("dict")["blocks"] if "lines" in block for line in block["lines"] for span in line["spans"]]
        for span in spans:
            assert page.rect.contains(fitz.Rect(span["bbox"])), f"Text outside page {i+1}"
        path = OUT / f"page-{i+1}.png"
        page.get_pixmap(matrix=fitz.Matrix(1, 1)).save(path)
        pages.append({"page": i+1, "width": page.rect.width, "height": page.rect.height, "render": path.relative_to(ROOT).as_posix()})
    result = {"status": "passed", "scope": "local PDF structure/links/text/rendering", "pages": pages,
              "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
              "annotations": sum(targets.values()), "distinctTargets": len(targets),
              "historicalLinksPreserved": True, "notesAndQaExcluded": True, "financialActions": 0}
    (OUT / "pdf-validation.json").write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "pages"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", action="store_true")
    parser.add_argument("--output", default="source-preservation.json", choices=["source-preservation.json", "publish-final-preservation.json"])
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    pdf() if args.pdf else source(args.output)
