#!/usr/bin/env python3
"""Preview-first reconciliation of one canonical TASK row and its dependents.

Markdown remains canonical. This stdlib-only helper validates the whole plan, resolves exactly one
task, updates that task's checkpoint evidence, recomputes dependent ready/blocked states, and
appends one structured fact-only ``task_checkpoint`` event. It never calls GitHub or writes until
``--apply`` is supplied with the SHA printed by an identical preview.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import os
import re
import sys
import tempfile
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


CHECKER_PATH = Path(__file__).with_name("check-implementation-plan.py")
if not CHECKER_PATH.exists():  # This repository historically keeps the shared toolkit in lowercase fmd/.
    CHECKER_PATH = Path(__file__).resolve().parents[2] / "fmd/tools/check-implementation-plan.py"
CHECKER_SPEC = importlib.util.spec_from_file_location("fmd_implementation_plan_checker", CHECKER_PATH)
if CHECKER_SPEC is None or CHECKER_SPEC.loader is None:  # pragma: no cover - invalid kit
    raise RuntimeError(f"cannot load implementation-plan checker from {CHECKER_PATH}")
CHECKER = importlib.util.module_from_spec(CHECKER_SPEC)
sys.modules[CHECKER_SPEC.name] = CHECKER
CHECKER_SPEC.loader.exec_module(CHECKER)
Task = CHECKER.Task
parse_tasks = CHECKER.parse_tasks
validate_text = CHECKER.validate_text


TASK_ID_RE = re.compile(r"TASK-\d{3}")
EVENT_ID_RE = re.compile(r"EVT-(\d+)")
COMMAND_RE = re.compile(r"`([^`\n]+)`")
RESULT_RE = re.compile(r"\bresult\s*:\s*(?P<result>[^·\n]+)", re.IGNORECASE)
ALLOWED_TARGET_STATUS = {"ready", "in_progress", "blocked", "done", "cut"}


@dataclass(frozen=True)
class Reconciliation:
    task_id: str
    status: str
    work_ref: str
    command: str
    result: str
    source: str
    at: str
    plan_text: str
    ledger_text: str
    updated_plan: str
    updated_ledger: str
    changed_task_ids: tuple[str, ...]
    event: dict[str, Any]


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ValueError(f"cannot read {path}: {exc}") from exc


def _load_tasks(text: str) -> list[Task]:
    errors = validate_text(text)
    if errors:
        raise ValueError("plan integrity rejected:\n  - " + "\n  - ".join(errors))
    tasks, parse_errors = parse_tasks(text)
    if parse_errors:
        raise ValueError("plan parser rejected an otherwise valid plan: " + "; ".join(parse_errors))
    return tasks


def _parse_ledger(text: str, ledger: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            raise ValueError(f"{ledger}:{line_no}: blank lines are not permitted in append-only JSONL")
        try:
            event = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{ledger}:{line_no}: invalid JSON: {exc.msg}") from exc
        if not isinstance(event, dict):
            raise ValueError(f"{ledger}:{line_no}: each event must be a JSON object")
        events.append(event)
    return events


def _next_event_id(events: list[dict[str, Any]]) -> str:
    highest = 0
    for event in events:
        match = EVENT_ID_RE.fullmatch(str(event.get("id", "")))
        if match:
            highest = max(highest, int(match.group(1)))
    return f"EVT-{highest + 1:03d}"


def resolve_task(
    tasks: list[Task],
    explicit_task: str | None,
    match_work_ref: str | None,
    match_scope: str | None,
    match_outcome: str | None,
) -> Task:
    """Use explicit TASK identity first; inference is deliberately narrow and fail-closed."""
    if explicit_task:
        if not TASK_ID_RE.fullmatch(explicit_task):
            raise ValueError("--task must match TASK-###")
        matches = [task for task in tasks if task.task_id == explicit_task]
        method = f"explicit task {explicit_task}"
    elif match_work_ref:
        matches = [task for task in tasks if task.work_ref == match_work_ref]
        method = f"work reference {match_work_ref!r}"
    elif match_scope is not None or match_outcome is not None:
        if not match_scope or not match_outcome:
            raise ValueError("scope/outcome inference requires both --match-scope and --match-outcome")
        matches = [
            task
            for task in tasks
            if task.write_scope == match_scope and task.outcome == match_outcome
        ]
        method = "declared scope and outcome"
    else:
        raise ValueError(
            "cannot resolve a task: supply --task TASK-###, or one unique --match-work-ref, "
            "or both --match-scope and --match-outcome"
        )
    if not matches:
        raise ValueError(f"task resolution found no match for {method}; Markdown was not changed")
    if len(matches) != 1:
        raise ValueError(
            f"task resolution is ambiguous for {method}: {', '.join(task.task_id for task in matches)}; "
            "Markdown was not changed"
        )
    return matches[0]


def _validate_arguments(args: argparse.Namespace) -> None:
    if args.status not in ALLOWED_TARGET_STATUS:
        raise ValueError("--status must be ready, in_progress, blocked, done, or cut")
    if not args.work_ref or not args.work_ref.strip():
        raise ValueError("--work-ref is required and cannot be blank")
    if not args.command or "`" in args.command or "\n" in args.command:
        raise ValueError("--command must be one exact local command without Markdown backticks or newlines")
    if not args.result or "\n" in args.result:
        raise ValueError("--result is required and must be one factual line")
    if args.status == "done" and args.result.strip().upper() != "PASS":
        raise ValueError("a done checkpoint requires --result PASS")
    if not args.source or not args.source.strip():
        raise ValueError("--source is required")
    if not args.at:
        raise ValueError("--at is required so preview and apply bind the same fact timestamp")
    try:
        datetime.fromisoformat(args.at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("--at must be an ISO-8601 timestamp") from exc


def _row_cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _render_row(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def _gate_evidence(command: str, result: str) -> str:
    return f"`{command}` · result: {result.strip()}"


def _update_rows(
    plan_text: str,
    tasks: list[Task],
    target: Task,
    status: str,
    work_ref: str,
    command: str,
    result: str,
) -> tuple[str, tuple[str, ...], str]:
    by_id = {task.task_id: task for task in tasks}
    statuses = {task.task_id: task.status for task in tasks}
    statuses[target.task_id] = status

    if status in {"ready", "in_progress", "done"}:
        unfinished = [dependency for dependency in target.dependencies if statuses[dependency] != "done"]
        if unfinished:
            raise ValueError(
                f"{target.task_id} cannot be {status}; unfinished dependencies: {', '.join(unfinished)}"
            )

    changed: set[str] = {target.task_id}
    # Recompute every dependent (including descendants): a changed upstream dependency can make a
    # previously done/ready/in-progress task blocked, while a formerly blocked task is ready once
    # every dependency is done. No work ref/evidence is rewritten for dependent rows.
    changed_state = True
    while changed_state:
        changed_state = False
        for task in tasks:
            if task.task_id == target.task_id or statuses[task.task_id] == "cut":
                continue
            unfinished = any(statuses[dependency] != "done" for dependency in task.dependencies)
            desired = "blocked" if unfinished else ("ready" if statuses[task.task_id] == "blocked" else statuses[task.task_id])
            if desired != statuses[task.task_id]:
                statuses[task.task_id] = desired
                changed.add(task.task_id)
                changed_state = True

    lines = plan_text.splitlines()
    trailing_newline = plan_text.endswith("\n")
    for task in tasks:
        if task.task_id not in changed:
            continue
        index = task.line - 1
        cells = _row_cells(lines[index])
        if len(cells) != 8 or cells[0] != task.task_id:
            raise ValueError(f"plan row for {task.task_id} changed while preparing reconciliation")
        cells[6] = statuses[task.task_id]
        if task.task_id == target.task_id:
            cells[5] = work_ref
            cells[7] = _gate_evidence(command, result)
        lines[index] = _render_row(cells)
    updated = "\n".join(lines) + ("\n" if trailing_newline else "")
    errors = validate_text(updated)
    if errors:
        raise ValueError("proposed plan integrity rejected:\n  - " + "\n  - ".join(errors))
    return updated, tuple(sorted(changed)), statuses[target.task_id]


def _checkpoint_event(
    *,
    event_id: str,
    at: str,
    task_id: str,
    status: str,
    work_ref: str,
    command: str,
    result: str,
    source: str,
    plan: Path,
    ledger: Path,
) -> dict[str, Any]:
    return {
        "id": event_id,
        "at": at,
        "type": "task_checkpoint",
        "task_id": task_id,
        "source": source,
        "evidence_ref": f"{command} · result: {result}",
        "docs_consulted": [
            {"path": str(plan), "used_for": "canonical task checkpoint"},
            {"path": str(ledger), "used_for": "append-only task evidence"},
        ],
        "rework": "unknown",
        "checkpoint": {
            "status": status,
            "work_ref": work_ref,
            "command": command,
            "result": result,
            "source": source,
        },
    }


def _append_jsonl(text: str, event: dict[str, Any]) -> str:
    prefix = text if not text or text.endswith("\n") else text + "\n"
    return prefix + json.dumps(event, sort_keys=True) + "\n"


def _digest(reconciliation: Reconciliation) -> str:
    payload = {
        "task_id": reconciliation.task_id,
        "status": reconciliation.status,
        "work_ref": reconciliation.work_ref,
        "command": reconciliation.command,
        "result": reconciliation.result,
        "source": reconciliation.source,
        "at": reconciliation.at,
        "plan_before": reconciliation.plan_text,
        "ledger_before": reconciliation.ledger_text,
        "plan_after": reconciliation.updated_plan,
        "ledger_after": reconciliation.updated_ledger,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def prepare(args: argparse.Namespace) -> Reconciliation:
    _validate_arguments(args)
    plan_text = _read(args.plan)
    ledger_text = _read(args.ledger) if args.ledger.exists() else ""
    tasks = _load_tasks(plan_text)
    target = resolve_task(tasks, args.task, args.match_work_ref, args.match_scope, args.match_outcome)
    events = _parse_ledger(ledger_text, args.ledger)
    updated_plan, changed_ids, actual_status = _update_rows(
        plan_text, tasks, target, args.status, args.work_ref.strip(), args.command.strip(), args.result.strip()
    )
    event = _checkpoint_event(
        event_id=_next_event_id(events),
        at=args.at,
        task_id=target.task_id,
        status=actual_status,
        work_ref=args.work_ref.strip(),
        command=args.command.strip(),
        result=args.result.strip(),
        source=args.source.strip(),
        plan=args.plan,
        ledger=args.ledger,
    )
    return Reconciliation(
        task_id=target.task_id,
        status=actual_status,
        work_ref=args.work_ref.strip(),
        command=args.command.strip(),
        result=args.result.strip(),
        source=args.source.strip(),
        at=args.at,
        plan_text=plan_text,
        ledger_text=ledger_text,
        updated_plan=updated_plan,
        updated_ledger=_append_jsonl(ledger_text, event),
        changed_task_ids=changed_ids,
        event=event,
    )


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(text)
    try:
        os.replace(temporary, path)
    except OSError:
        temporary.unlink(missing_ok=True)
        raise


def run(args: argparse.Namespace) -> int:
    try:
        reconciliation = prepare(args)
        digest = _digest(reconciliation)
        print(f"RESOLVED: {reconciliation.task_id} → {reconciliation.status}")
        print("Rows changed: " + ", ".join(reconciliation.changed_task_ids))
        print("Event to append: " + json.dumps(reconciliation.event, sort_keys=True))
        print(f"PLAN SHA256: {digest}")
        if not args.apply:
            print("PREVIEW ONLY: no Markdown or evidence was changed. Re-run with --apply and this exact SHA.")
            return 0
        if not args.expected_plan_sha:
            raise ValueError("--apply requires --expected-plan-sha from a reviewed preview")
        if args.expected_plan_sha != digest:
            raise ValueError("preview no longer matches current plan, ledger, or checkpoint input; no files were changed")
        # Detect any state drift after planning before replacing either canonical file.
        if _read(args.plan) != reconciliation.plan_text or (args.ledger.exists() and _read(args.ledger) != reconciliation.ledger_text):
            raise ValueError("plan or ledger changed after preview preparation; no files were changed")
        _atomic_write(args.plan, reconciliation.updated_plan)
        _atomic_write(args.ledger, reconciliation.updated_ledger)
        print(f"APPLIED: {reconciliation.task_id} checkpoint and one appended event")
        return 0
    except ValueError as exc:
        print(f"REJECT: {exc}", file=sys.stderr)
        return 1


def _arguments(**overrides: Any) -> argparse.Namespace:
    values: dict[str, Any] = {
        "plan": Path("plan.md"),
        "ledger": Path("run-evidence.jsonl"),
        "task": "TASK-001",
        "match_work_ref": None,
        "match_scope": None,
        "match_outcome": None,
        "status": "done",
        "work_ref": "task/TASK-001-checkpoint",
        "command": "npm test",
        "result": "PASS",
        "source": "test",
        "at": "2026-07-25T12:00:00+00:00",
        "apply": False,
        "expected_plan_sha": None,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def self_test() -> int:
    fixture = """# Plan

| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |
|----|----|----|----|----|----|----|----|
| TASK-001 | bootstrap; infra | — | A | src/a | task/TASK-001-checkpoint | in_progress | `npm test` |
| TASK-002 | dependent docs | TASK-001 | B | docs/a | — | blocked | `python3 check.py` |
| TASK-003 | child test | TASK-002 | C | test/a | — | blocked | `python3 test.py` |
"""
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as directory:
        plan = Path(directory) / "plan.md"
        ledger = Path(directory) / "run-evidence.jsonl"
        plan.write_text(fixture, encoding="utf-8")
        ledger.write_text("", encoding="utf-8")
        args = _arguments(plan=plan, ledger=ledger)
        try:
            preview = prepare(args)
            if preview.changed_task_ids != ("TASK-001", "TASK-002"):
                failures.append(f"unexpected dependency unblocking set: {preview.changed_task_ids}")
            preview_tasks = {task.task_id: task for task in _load_tasks(preview.updated_plan)}
            if preview_tasks["TASK-001"].status != "done" or preview_tasks["TASK-002"].status != "ready":
                failures.append("done checkpoint did not unblock its direct dependent")
            if preview_tasks["TASK-003"].status != "blocked":
                failures.append("unrelated blocked descendant changed unexpectedly")
            if len(_parse_ledger(preview.updated_ledger, ledger)) != 1:
                failures.append("checkpoint did not append exactly one event")
        except ValueError as exc:
            failures.append(f"valid explicit preview rejected: {exc}")
            preview = None

        source_tasks = _load_tasks(fixture)
        try:
            if resolve_task(source_tasks, None, "task/TASK-001-checkpoint", None, None).task_id != "TASK-001":
                failures.append("work-ref fallback selected the wrong task")
            if resolve_task(source_tasks, None, None, "src/a", "bootstrap; infra").task_id != "TASK-001":
                failures.append("scope/outcome fallback selected the wrong task")
        except ValueError as exc:
            failures.append(f"valid fallback resolution rejected: {exc}")
        for selector in (
            (None, "missing-branch", None, None),
            (None, None, "src/a", None),
        ):
            try:
                resolve_task(source_tasks, *selector)
                failures.append(f"invalid task resolution was accepted: {selector}")
            except ValueError:
                pass
        ambiguous = list(source_tasks) + [
            Task("TASK-004", "second; docs", (), "D", "docs/d", "task/TASK-001-checkpoint", "ready", "`t`", 99)
        ]
        try:
            resolve_task(ambiguous, None, "task/TASK-001-checkpoint", None, None)
            failures.append("ambiguous work-ref resolution was accepted")
        except ValueError:
            pass

        if preview is not None:
            before_plan = plan.read_text(encoding="utf-8")
            before_ledger = ledger.read_text(encoding="utf-8")
            wrong = _arguments(plan=plan, ledger=ledger, apply=True, expected_plan_sha="0" * 64)
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                wrong_code = run(wrong)
            if wrong_code == 0 or plan.read_text(encoding="utf-8") != before_plan or ledger.read_text(encoding="utf-8") != before_ledger:
                failures.append("stale SHA was not rejected without writes")
            correct = _arguments(plan=plan, ledger=ledger, apply=True, expected_plan_sha=_digest(preview))
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                correct_code = run(correct)
            if correct_code != 0:
                failures.append("valid SHA-bound apply failed")

            repair = _arguments(
                plan=plan,
                ledger=ledger,
                status="in_progress",
                result="REOPENED after review evidence",
                command="npm test -- checkpoint",
            )
            try:
                reblocked = prepare(repair)
                reblocked_tasks = {task.task_id: task for task in _load_tasks(reblocked.updated_plan)}
                if reblocked_tasks["TASK-002"].status != "blocked":
                    failures.append("unfinished dependency did not re-block its dependent")
            except ValueError as exc:
                failures.append(f"repair/reblocking preview failed: {exc}")

    if failures:
        print("SELF-TEST FAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("SELF-TEST PASS: explicit/fallback resolution, ambiguity/no-match rejection, SHA binding, dependency updates, and append-only events")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=Path("docs/implementation-plan.md"))
    parser.add_argument("--ledger", type=Path, default=Path("docs/run-evidence.jsonl"))
    parser.add_argument("--task", help="explicit TASK-### (the normal, preferred resolution path)")
    parser.add_argument("--match-work-ref", help="fallback: exact existing Work ref that uniquely identifies a task")
    parser.add_argument("--match-scope", help="fallback: exact existing Write scope; requires --match-outcome")
    parser.add_argument("--match-outcome", help="fallback: exact existing Outcome / trace; requires --match-scope")
    parser.add_argument("--status", choices=sorted(ALLOWED_TARGET_STATUS))
    parser.add_argument("--work-ref", help="new exact branch, PR, or work reference for the checkpointed row")
    parser.add_argument("--command", help="exact local command, without Markdown backticks")
    parser.add_argument("--result", help="factual observed result; done requires PASS")
    parser.add_argument("--source", help="observed source, for example test, CI, PR, human, or other")
    parser.add_argument("--at", help="ISO-8601 observation time; required to bind preview and apply")
    parser.add_argument("--apply", action="store_true", help="write the previewed plan row changes and appended event")
    parser.add_argument("--expected-plan-sha", help="exact SHA-256 printed by a reviewed preview; required with --apply")
    parser.add_argument("--self-test", action="store_true", help="run deterministic offline fixtures")
    args = parser.parse_args(argv)
    if args.self_test:
        return self_test()
    required = (args.status, args.work_ref, args.command, args.result, args.source, args.at)
    if any(value is None for value in required):
        parser.error("--status, --work-ref, --command, --result, --source, and --at are required")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
