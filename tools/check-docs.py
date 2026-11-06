#!/usr/bin/env python3
"""Check the AegisPay documentation contract; never claims application tests passed."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ID = re.compile(r"\b(?:F|INV|UJ|BR|API|TC|TASK|EQ|DS)-\d{3}\b")
LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def table_ids(text: str, prefix: str) -> set[str]:
    return set(re.findall(r"^\|\s*(" + prefix + r"-\d{3})\s*\|", text, re.M))


def main() -> int:
    errors: list[str] = []
    files = sorted(DOCS.glob("*.md")) + [ROOT / name for name in
        ("IDEA.md", "context.md", "AGENTS.md", "CLAUDE.md", "README.md")]
    required = {
        "prd.md": ["Overview & goals", "Personas & use cases", "User stories", "User journeys",
                   "Feature list", "Business rules", "Hard rules", "User flows", "Acceptance criteria",
                   "Non-goals", "Dependencies", "Open questions"],
        "system-design.md": ["Context diagram", "Components & responsibilities", "Data flow",
                             "Key technology choices", "Integration points", "Deployment topology",
                             "Scaling strategy", "Trade-offs considered"],
        "data-model.md": ["Entities & relationships", "Schema / field definitions", "Constraints & indexes",
                          "Retention & privacy", "Migration notes"],
        "security-compliance.md": ["Data classification", "Authn / authz model", "Threat model",
                                   "Abuse & safety", "Compliance obligations", "Secrets handling",
                                   "Audit & logging", "Incident response", "Pre-milestone"],
        "implementation-plan.md": ["Planning inputs", "Task ledger", "Checkpoint transaction",
                                   "GitHub delivery projection", "Run evidence", "Plan change log"],
        "api-spec.md": ["Overview", "Authentication & authorization", "Endpoints / operations",
                        "Error codes", "Rate limits", "Versioning"],
        "design-system.md": ["Design principles", "Component inventory", "Tokens", "Patterns & states",
                             "UI voice & copy", "Accessibility standards", "Key screen specs"],
        "methods.md": ["glass-box contract", "Confidence rubric", "Equation registry",
                       "Dataset / input registry", "Traceability"],
        "onboarding.md": ["What this is", "Read first", "Run it locally", "Where things live", "Conventions"],
        "pitch-kit.md": ["Business narrative", "Business Model Canvas", "Timed script",
                         "Q&A ownership map", "Interview probe"],
    }
    for name, headings in required.items():
        path = DOCS / name
        if not path.exists():
            errors.append(f"missing document: docs/{name}")
            continue
        text = read(path)
        for heading in headings:
            if not re.search(r"^#{1,6} .*" + re.escape(heading), text, re.M | re.I):
                errors.append(f"{name}: missing section {heading}")

    for path in files:
        if not path.exists():
            errors.append(f"missing root file: {path.name}")
            continue
        text = read(path)
        if "\ufffd" in text:
            errors.append(f"{path.name}: replacement character / encoding error")
        # Only generated files: the original idea may deliberately use placeholders in examples.
        if path.name != "IDEA.md" and re.search(r"\{(?:project_name|owner|date|status|fmd_version)\}", text):
            errors.append(f"{path.name}: unresolved template field")
        for target in LINK.findall(text):
            if re.match(r"(?:https?://|mailto:|#)", target):
                continue
            relative = unquote(target.split("#", 1)[0]).strip("<>")
            if relative and not (path.parent / relative).exists():
                errors.append(f"{path.relative_to(ROOT)}: broken link {target}")

    idea, prd, qa = (read(ROOT / "IDEA.md"), read(DOCS / "prd.md"), read(DOCS / "qa-test-plan.md"))
    addendum = idea.split("## 23. Execution addendum", 1)[-1]
    features = table_ids(addendum, "F")
    invariants = table_ids(addendum, "INV")
    if len(features) != 12 or len(invariants) != 10:
        errors.append("source addendum must contain 12 features and 10 invariants")
    if table_ids(prd, "F") != features:
        errors.append("PRD feature table does not match source IDs")
    qa_rows = [row for row in qa.splitlines() if re.match(r"^\| TC-\d{3} \|", row)]
    for identifier in features | invariants:
        if identifier not in prd:
            errors.append(f"PRD missing {identifier}")
        if not any(identifier in row for row in qa_rows):
            errors.append(f"QA case missing for {identifier}")
    for identifier in invariants:
        for name in ("security-compliance.md", "design-system.md"):
            if identifier not in read(DOCS / name):
                errors.append(f"{name}: missing invariant enforcement/copy {identifier}")

    definitions = features | invariants
    definitions |= set(re.findall(r"\*\*((?:UJ|BR)-\d{3})", prd))
    definitions |= table_ids(qa, "TC")
    definitions |= table_ids(read(DOCS / "implementation-plan.md"), "TASK")
    definitions |= set(re.findall(r"^### (API-\d{3})", read(DOCS / "api-spec.md"), re.M))
    definitions |= table_ids(read(DOCS / "methods.md"), "EQ")
    definitions |= table_ids(read(DOCS / "methods.md"), "DS")
    for path in files:
        if path.name == "IDEA.md":
            continue
        unknown = set(ID.findall(read(path))) - definitions
        if unknown:
            errors.append(f"{path.name}: undefined refs {', '.join(sorted(unknown))}")

    index = read(DOCS / "index.md").split("## 1.", 1)[0]
    for path in DOCS.glob("*.md"):
        if f"]({path.name})" not in index:
            errors.append(f"index §0 does not list {path.name}")

    evidence = json.loads(read(DOCS / "evidence" / "package-research.json"))
    packages = {row["package"]: row for row in evidence["packages"]}
    noir = packages["@noirx402/agent-sdk"]
    stellar = packages["@stellar/stellar-sdk"]
    if noir["peerDependencies"]["@stellar/stellar-sdk"] != "^16.0.1" or not stellar["version"].startswith("16."):
        errors.append("researched Noir/Stellar peer decision no longer matches checked metadata")
    if evidence["local_node"] != "24.22.1":
        errors.append("runtime research changed; reconcile architecture pins")

    if errors:
        print("FAIL — documentation contract")
        for error in errors:
            print(f"  {error}")
        return 1
    print(f"PASS — {len(files)} Markdown files; local links, required sections, "
          f"{len(features)} features, {len(invariants)} invariants, {len(qa_rows)} QA cases, "
          "stable references, index inventory and researched SDK peer decision.")
    print("Application tests and live SDK/ledger integration remain unrun.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
