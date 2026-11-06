#!/usr/bin/env python3
"""Validate an emitted FMD implementation-plan task ledger (stdlib only).

Deterministic checks:
- one or more categorized canonical task tables, each with one separator immediately after its header
- every row in each table is parsed; malformed/hidden rows cannot be skipped
- every data row has a valid, unique TASK-### ID
- allowed statuses and required cells
- dependency cells contain only unique comma-separated TASK-### IDs (or an em dash), resolve,
  do not self-reference, and form an acyclic graph
- ready/in-progress/done work has only done dependencies
- each task traces to an exact F-/INV-### ID or explicitly says infra/docs/test
- claimed/done work has a work ref
- done work has explicit observed result/artifact evidence outside the command

On a valid plan it also EMITS (does not gate on) the topological execution waves and flags
same-wave write-scope overlaps as parallel-safety warnings. Warnings are advisory by default and
become failures under --strict.

Judgment deliberately excluded: slice quality (vertical vs horizontal), owner suitability, semantic
write-scope independence (only LITERAL path overlap is detected — two disjoint paths that import the
same module are not caught), and whether a conflict resolution preserves product intent.
"""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

TASK_ID_RE = re.compile(r"^TASK-\d{3}$")
TRACE_TOKEN_RE = re.compile(r"(?<![A-Za-z0-9_-])(?:F|INV)-[A-Za-z0-9_-]+", re.IGNORECASE)
TRACE_ID_RE = re.compile(r"^(?:F|INV)-\d{3}$")
NON_PRODUCT_TRACE_RE = re.compile(r"\b(?:infra|docs|test)\b", re.IGNORECASE)
ALLOWED_STATUS = {"ready", "in_progress", "blocked", "done", "cut"}
ACTIVE_STATUS = {"ready", "in_progress", "done"}
CLAIMED_STATUS = {"in_progress", "done"}
COMMAND_RE = re.compile(r"`[^`\n]+`")
RESULT_RE = re.compile(
    r"\b(?:result|observed|ci)\s*[:=]\s*(?:(?:pass(?:ed)?|succeed(?:ed)?|green|"
    r"exit(?:\s+code)?\s*[:=]?\s*0)\b|✅)|"
    r"\bartifact(?:\s+url)?\s*[:=]\s*https?://\S+",
    re.IGNORECASE,
)
PLACEHOLDER_RE = re.compile(r"^\s*(?:—|-|<.*>|tbd|todo|n/?a)?\s*$", re.IGNORECASE)
SEPARATOR_RE = re.compile(r"^:?-{3,}:?$")
HEADING_RE = re.compile(r"^#{1,6}\s+")
EXPECTED_HEADER = (
    "id",
    "outcome / trace",
    "depends on",
    "owner",
    "write scope",
    "work ref",
    "status",
    "gate / evidence",
)
EXPECTED_COLUMNS = len(EXPECTED_HEADER)


@dataclass(frozen=True)
class Task:
    task_id: str
    outcome: str
    dependencies: tuple[str, ...]
    owner: str
    write_scope: str
    work_ref: str
    status: str
    gate: str
    line: int


def _cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _is_separator(cells: list[str]) -> bool:
    return len(cells) == EXPECTED_COLUMNS and all(SEPARATOR_RE.fullmatch(c) for c in cells)


def _parse_dependencies(raw: str, task_id: str, line: int, errors: list[str]) -> tuple[str, ...]:
    value = raw.strip().strip("`").strip()
    if value in {"—", "-"}:
        return ()
    if not value:
        errors.append(f"line {line}: {task_id} dependency cell is blank; use — for none")
        return ()

    dependencies: list[str] = []
    seen: set[str] = set()
    for token in (part.strip().strip("`") for part in value.split(",")):
        if not TASK_ID_RE.fullmatch(token):
            errors.append(
                f"line {line}: {task_id} has malformed dependency '{token}'; "
                "use comma-separated TASK-### IDs or —"
            )
            continue
        if token in seen:
            errors.append(f"line {line}: {task_id} repeats dependency {token}")
            continue
        seen.add(token)
        dependencies.append(token)
    return tuple(dependencies)


def parse_tasks(text: str) -> tuple[list[Task], list[str]]:
    lines = text.splitlines()
    errors: list[str] = []
    header_lines = [
        i
        for i, line in enumerate(lines)
        if line.lstrip().startswith("|")
        and tuple(cell.lower() for cell in _cells(line)) == EXPECTED_HEADER
    ]
    if not header_lines:
        errors.append("expected at least one canonical task-table header")
        return [], errors

    tasks: list[Task] = []
    for header_position, header_index in enumerate(header_lines):
        separator_index = header_index + 1
        if separator_index >= len(lines) or not lines[separator_index].lstrip().startswith("|"):
            errors.append(f"line {header_index + 2}: canonical separator must immediately follow task header")
            continue
        separator_cells = _cells(lines[separator_index])
        if not _is_separator(separator_cells):
            errors.append(
                f"line {separator_index + 1}: malformed task-table separator; "
                f"expected {EXPECTED_COLUMNS} Markdown separator cells"
            )
            continue

        table_end = next(
            (index for index in range(separator_index + 1, len(lines)) if HEADING_RE.match(lines[index])),
            len(lines),
        )
        gap_started = False
        for index in range(separator_index + 1, table_end):
            line = lines[index]
            line_no = index + 1
            if not line.strip():
                gap_started = True
                continue
            if not line.lstrip().startswith("|"):
                errors.append(
                    f"line {line_no}: malformed non-table content inside task ledger; "
                    "every task row must be a Markdown pipe row before the next heading"
                )
                continue
            if gap_started:
                errors.append(
                    f"line {line_no}: task row appears after a blank line; "
                    "task rows must be contiguous so none can be hidden"
                )
            cells = _cells(line)
            if _is_separator(cells):
                errors.append(
                    f"line {line_no}: unexpected separator after task data; "
                    "the only separator must immediately follow the header"
                )
                continue
            if len(cells) != EXPECTED_COLUMNS:
                label = cells[0] if cells else "<blank>"
                errors.append(
                    f"line {line_no}: task row '{label}' has {len(cells)} columns; "
                    f"expected {EXPECTED_COLUMNS}"
                )
                continue
            task_id, outcome, depends, owner, scope, work_ref, status, gate = cells
            if not TASK_ID_RE.fullmatch(task_id):
                errors.append(
                    f"line {line_no}: task row has blank/malformed ID '{task_id}'; expected TASK-###"
                )
                continue
            dependencies = _parse_dependencies(depends, task_id, line_no, errors)
            tasks.append(Task(task_id, outcome, dependencies, owner, scope, work_ref, status, gate, line_no))

    if not tasks:
        errors.append("no valid task rows found below the canonical task-table header")
    return tasks, errors


def _has_observed_result(gate: str) -> bool:
    """Ignore inline command text, then require an explicit result/CI/artifact label."""
    evidence_only = COMMAND_RE.sub("", gate)
    return bool(RESULT_RE.search(evidence_only))


def validate_text(text: str) -> list[str]:
    tasks, errors = parse_tasks(text)
    by_id: dict[str, Task] = {}

    for task in tasks:
        if task.task_id in by_id:
            errors.append(
                f"line {task.line}: duplicate {task.task_id} "
                f"(first at line {by_id[task.task_id].line})"
            )
        else:
            by_id[task.task_id] = task

        for label, value in (
            ("outcome", task.outcome),
            ("owner", task.owner),
            ("write scope", task.write_scope),
            ("gate/evidence", task.gate),
        ):
            if PLACEHOLDER_RE.fullmatch(value):
                errors.append(f"line {task.line}: {task.task_id} has missing/placeholder {label}")

        trace_tokens = TRACE_TOKEN_RE.findall(task.outcome)
        malformed_traces = [token for token in trace_tokens if not TRACE_ID_RE.fullmatch(token)]
        if malformed_traces:
            errors.append(
                f"line {task.line}: {task.task_id} has malformed trace ID(s): "
                f"{', '.join(malformed_traces)}; use exact uppercase F-###/INV-###"
            )
        has_exact_trace = any(TRACE_ID_RE.fullmatch(token) for token in trace_tokens)
        if not has_exact_trace and not NON_PRODUCT_TRACE_RE.search(task.outcome):
            errors.append(
                f"line {task.line}: {task.task_id} outcome must reference an exact "
                "uppercase F-###/INV-### ID or explicitly say infra/docs/test"
            )
        if task.status not in ALLOWED_STATUS:
            errors.append(
                f"line {task.line}: {task.task_id} status '{task.status}' is invalid; "
                f"allowed: {', '.join(sorted(ALLOWED_STATUS))}"
            )
        if task.task_id in task.dependencies:
            errors.append(f"line {task.line}: {task.task_id} depends on itself")
        if not COMMAND_RE.search(task.gate):
            errors.append(
                f"line {task.line}: {task.task_id} gate/evidence needs an exact command in backticks"
            )
        if task.status in CLAIMED_STATUS and PLACEHOLDER_RE.fullmatch(task.work_ref):
            errors.append(f"line {task.line}: {task.task_id} status {task.status} needs a work ref")
        if task.status == "done" and not _has_observed_result(task.gate):
            errors.append(
                f"line {task.line}: {task.task_id} status done needs observed evidence "
                "outside the command (result: PASS/exit 0, CI: green, or artifact: URL)"
            )

    for task in tasks:
        for dependency in task.dependencies:
            if dependency not in by_id:
                errors.append(f"line {task.line}: {task.task_id} depends on missing task {dependency}")

    for task in tasks:
        if task.status not in ACTIVE_STATUS:
            continue
        unfinished = [
            dependency
            for dependency in task.dependencies
            if dependency in by_id and by_id[dependency].status != "done"
        ]
        if unfinished:
            errors.append(
                f"line {task.line}: {task.task_id} status {task.status} has unfinished "
                f"dependencies: {', '.join(unfinished)}"
            )

    state: dict[str, int] = {task_id: 0 for task_id in by_id}
    stack: list[str] = []
    reported_cycles: set[tuple[str, ...]] = set()

    def visit(task_id: str) -> None:
        if state[task_id] == 2:
            return
        if state[task_id] == 1:
            start = stack.index(task_id)
            cycle = tuple(stack[start:] + [task_id])
            if cycle not in reported_cycles:
                reported_cycles.add(cycle)
                errors.append("dependency cycle: " + " -> ".join(cycle))
            return
        state[task_id] = 1
        stack.append(task_id)
        for dependency in by_id[task_id].dependencies:
            if dependency in by_id:
                visit(dependency)
        stack.pop()
        state[task_id] = 2

    for task_id in by_id:
        visit(task_id)

    return errors


def _scope_paths(scope: str) -> list[str]:
    """Normalize a write-scope cell into comparable path tokens."""
    tokens = []
    for segment in scope.split(","):
        cleaned = segment.strip().strip("`").strip().strip("/").lower()
        if cleaned:
            tokens.append(cleaned)
    return tokens


def _scope_overlap(a: str, b: str) -> tuple[str, str] | None:
    """Return the first equal-or-nested path pair between two scopes, else None.

    Literal path comparison only: 'src/api' overlaps 'src/api/users' (nested) and 'src/api'
    (equal), but not 'src/web'. It cannot see semantic coupling (shared imports).
    """
    for x in _scope_paths(a):
        for y in _scope_paths(b):
            if x == y or x.startswith(y + "/") or y.startswith(x + "/"):
                return (x, y)
    return None


def compute_waves(by_id: dict[str, Task]) -> dict[int, list[str]]:
    """Topological layers of the dependency DAG.

    wave(t) = 0 if t has no dependencies, else 1 + max(wave(d) for d in deps). Two tasks in the
    same wave have no dependency path between them, so they are candidates for parallel work.
    Assumes an already-validated (acyclic, fully resolved) graph.
    """
    wave_of: dict[str, int] = {}

    def wave(task_id: str) -> int:
        if task_id in wave_of:
            return wave_of[task_id]
        deps = by_id[task_id].dependencies
        value = 0 if not deps else 1 + max(wave(dep) for dep in deps)
        wave_of[task_id] = value
        return value

    groups: dict[int, list[str]] = {}
    for task_id in by_id:
        groups.setdefault(wave(task_id), []).append(task_id)
    return groups


def parallel_safety_warnings(
    by_id: dict[str, Task], groups: dict[int, list[str]]
) -> list[tuple[int, str, str, tuple[str, str]]]:
    """Flag same-wave task pairs whose write scopes literally overlap."""
    warnings: list[tuple[int, str, str, tuple[str, str]]] = []
    for wave_no, ids in groups.items():
        ordered = sorted(ids)
        for i in range(len(ordered)):
            for j in range(i + 1, len(ordered)):
                shared = _scope_overlap(by_id[ordered[i]].write_scope, by_id[ordered[j]].write_scope)
                if shared:
                    warnings.append((wave_no, ordered[i], ordered[j], shared))
    return warnings


def check(path: Path, strict: bool = False) -> int:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"ERROR: cannot read {path}: {exc}", file=sys.stderr)
        return 2
    errors = validate_text(text)
    if errors:
        print(f"REJECT: {path} has {len(errors)} plan-integrity failure(s)")
        for error in errors:
            print(f"  - {error}")
        return 1
    tasks, _ = parse_tasks(text)
    by_id = {task.task_id: task for task in tasks}
    groups = compute_waves(by_id)
    warnings = parallel_safety_warnings(by_id, groups)

    print(f"APPROVE: {path} has {len(tasks)} valid task row(s); dependency/state DAG is coherent")
    print("Execution waves (topological layers; same wave = parallel candidates):")
    for wave_no in sorted(groups):
        print(f"  wave {wave_no}: {', '.join(sorted(groups[wave_no]))}")
    if warnings:
        print("Parallel-safety warnings (same-wave write-scope overlap — serialize, split, or add a dependency):")
        for wave_no, first, second, (path_a, path_b) in warnings:
            detail = f"'{path_a}'" if path_a == path_b else f"'{path_a}' vs '{path_b}'"
            print(f"  wave {wave_no}: {first} and {second} both write {detail}")
        if strict:
            print(f"REJECT (strict): {len(warnings)} parallel-safety warning(s) promoted to failures")
            return 1
    else:
        print("Parallel-safety: no same-wave write-scope overlaps detected")
    return 0


def self_test() -> int:
    valid = """| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |
|----|----|----|----|----|----|----|----|
| TASK-001 | runnable skeleton; infra | — | Alex | src/config | task/TASK-001-scaffold | done | `npm test` · result: PASS · PR #1 |
| TASK-002 | core journey; F-001 | TASK-001 | Bea | src/core, tests/core | PR #2 | in_progress | TC-001 · `npm test -- core` |
| TASK-003 | docs reconciliation | TASK-002 | Alex | docs/ | — | blocked | `python check-docs.py` |

## Execution view
- Ready: none
"""
    invalid_cases = {
        "duplicate ID": valid.replace("\n\n## Execution", "\n| TASK-003 | extra tests | — | C | tests/ | — | ready | `npm test` |\n\n## Execution", 1),
        "blank ID": valid.replace("| TASK-003 | docs reconciliation", "|  | docs reconciliation", 1),
        "malformed ID": valid.replace("| TASK-003 | docs reconciliation", "| TASK-XYZ | docs reconciliation", 1),
        "missing dependency": valid.replace("| TASK-002 | core journey; F-001 | TASK-001 |", "| TASK-002 | core journey; F-001 | TASK-999 |", 1),
        "malformed dependency": valid.replace("| TASK-003 | docs reconciliation | TASK-002 |", "| TASK-003 | docs reconciliation | TASK-XYZ |", 1),
        "duplicate dependency": valid.replace("| TASK-003 | docs reconciliation | TASK-002 |", "| TASK-003 | docs reconciliation | TASK-002, TASK-002 |", 1),
        "cycle": valid.replace("| TASK-001 | runnable skeleton; infra | — |", "| TASK-001 | runnable skeleton; infra | TASK-002 |", 1),
        "done without work ref": valid.replace("task/TASK-001-scaffold | done", "— | done", 1),
        "done without result": valid.replace(" · result: PASS · PR #1", " · PR #1", 1),
        "PASS only inside command": valid.replace("`npm test` · result: PASS · PR #1", "`printf PASS` · PR #1", 1),
        "exit zero only inside command": valid.replace("`npm test` · result: PASS · PR #1", "`sh -c \"exit 0\"` · PR #1", 1),
        "ready with unfinished dependency": valid.replace("| — | blocked | `python check-docs.py` |", "| — | ready | `python check-docs.py` |", 1),
        "invalid status": valid.replace("| — | blocked | `python check-docs.py` |", "| — | planned | `python check-docs.py` |", 1),
        "partial trace ID": valid.replace("core journey; F-001", "core journey; F-001X", 1),
        "lowercase trace ID": valid.replace("core journey; F-001", "core journey; f-001", 1),
        "underscore trace with docs fallback": valid.replace("docs reconciliation", "docs reconciliation F-001_extra", 1),
        "underscore invariant with test fallback": valid.replace("core journey; F-001", "test journey; INV-001_extra", 1),
        "separator after data": valid.replace("\n\n## Execution", "\n|---|---|---|---|---|---|---|---|\n\n## Execution", 1),
        "row after blank": valid.replace("\n\n## Execution", "\n\n| TASK-004 | extra test | — | C | tests/ | — | ready | `npm test` |\n## Execution", 1),
        "malformed non-pipe row": valid.replace("\n\n## Execution", "\nTASK-004 | extra test | — | C | tests/ | — | ready | npm test\n\n## Execution", 1),
    }
    failures: list[str] = []
    valid_errors = validate_text(valid)
    if valid_errors:
        failures.append("valid fixture was rejected: " + "; ".join(valid_errors))
    categorized = valid.replace(
        "| TASK-003 | docs reconciliation | TASK-002 | Alex | docs/ | — | blocked | `python check-docs.py` |\n",
        "",
        1,
    ).replace(
        "\n## Execution view",
        "\n\n### Blocked\n"
        "| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |\n"
        "|----|----|----|----|----|----|----|----|\n"
        "| TASK-003 | docs reconciliation | TASK-002 | Alex | docs/ | — | blocked | `python check-docs.py` |\n"
        "\n## Execution view",
        1,
    )
    categorized_errors = validate_text(categorized)
    if categorized_errors:
        failures.append("categorized fixture was rejected: " + "; ".join(categorized_errors))
    for name, fixture in invalid_cases.items():
        if not validate_text(fixture):
            failures.append(f"invalid fixture '{name}' was accepted")

    # Wave computation + parallel-safety detection (success-path features).
    wave_plan = """| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |
|----|----|----|----|----|----|----|----|
| TASK-001 | skeleton; infra | — | A | src/config | task/TASK-001-x | done | `t` · result: PASS |
| TASK-002 | login; F-001 | TASK-001 | B | src/api | task/TASK-002-login | in_progress | `t` |
| TASK-003 | posts; F-002 | TASK-001 | C | src/api/users | task/TASK-003-posts | in_progress | `t` |
| TASK-004 | profile; F-003 | TASK-001 | D | src/profile | task/TASK-004-profile | in_progress | `t` |
"""
    wave_tasks, wave_errors = parse_tasks(wave_plan)
    if wave_errors:
        failures.append("wave fixture unexpectedly rejected: " + "; ".join(wave_errors))
    else:
        wave_by_id = {task.task_id: task for task in wave_tasks}
        groups = {wave_no: sorted(ids) for wave_no, ids in compute_waves(wave_by_id).items()}
        if groups != {0: ["TASK-001"], 1: ["TASK-002", "TASK-003", "TASK-004"]}:
            failures.append(f"unexpected wave grouping: {groups}")
        pairs = {(a, b) for _, a, b, _ in parallel_safety_warnings(wave_by_id, compute_waves(wave_by_id))}
        if ("TASK-002", "TASK-003") not in pairs:
            failures.append("nested scope overlap src/api vs src/api/users not detected")
        if ("TASK-002", "TASK-004") in pairs or ("TASK-003", "TASK-004") in pairs:
            failures.append("false-positive overlap flagged against disjoint scope src/profile")

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "implementation-plan.md"
        path.write_text(valid, encoding="utf-8")
        if check(path) != 0:
            failures.append("valid temporary file failed check()")

    if failures:
        print("SELF-TEST FAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print(f"SELF-TEST PASS: 1 valid + {len(invalid_cases)} invalid cases behaved as expected")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", nargs="?", type=Path, help="path to docs/implementation-plan.md")
    parser.add_argument("--self-test", action="store_true", help="run built-in positive/negative tests")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="promote same-wave write-scope overlap warnings to failures",
    )
    args = parser.parse_args(argv)
    if args.self_test:
        return self_test()
    if args.plan is None:
        parser.error("provide a plan path or --self-test")
    return check(args.plan, strict=args.strict)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
