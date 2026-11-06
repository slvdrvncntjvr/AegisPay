#!/usr/bin/env python3
"""Validate a declared GuidHer task checkpoint in unexecuted PR-head documents.

This is deliberately stdlib-only and network-free. The GitHub workflow checks out this trusted
default-branch tool, fetches only the PR head's Markdown/JSONL as data, supplies read-only Issue
metadata, and never checks out or runs code from the pull request.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CHECKER_PATH = Path(__file__).with_name("check-implementation-plan.py")
if not CHECKER_PATH.exists():  # The trusted guard may live in FMD/ beside the legacy lowercase toolkit.
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


RUN_ID_RE = re.compile(r"^\*\*Run ID:\*\*\s*`(?P<run>RUN-[A-Za-z0-9-]+)`\s*$", re.MULTILINE)
TASKISH_RE = re.compile(r"^\s*Task\s*:")
TASK_LINE_RE = re.compile(r"^Task:\s*(TASK-\d{3})\s*$")
ISSUEISH_RE = re.compile(r"^\s*(?:Closes|Refs)\b")
ISSUE_LINE_RE = re.compile(r"^(?P<verb>Closes|Refs)\s+#(?P<number>\d+)\s*$")
COMMAND_RE = re.compile(r"`([^`\n]+)`")
RESULT_RE = re.compile(r"\bresult\s*:\s*(?P<result>[^·\n]+)", re.IGNORECASE)


@dataclass(frozen=True)
class PrMetadata:
    body: str
    branch: str


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ValueError(f"cannot read {path}: {exc}") from exc


def _tasks(text: str, label: str) -> dict[str, Task]:
    errors = validate_text(text)
    if errors:
        raise ValueError(f"{label} plan integrity rejected:\n  - " + "\n  - ".join(errors))
    tasks, parse_errors = parse_tasks(text)
    if parse_errors:
        raise ValueError(f"{label} plan parser rejected: " + "; ".join(parse_errors))
    return {task.task_id: task for task in tasks}


def _run_id(text: str) -> str:
    match = RUN_ID_RE.search(text)
    if not match:
        raise ValueError("head plan is missing **Run ID:** `RUN-...`")
    return match.group("run")


def _events(text: str, label: str) -> list[dict[str, Any]]:
    if not text:
        return []
    events: list[dict[str, Any]] = []
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            raise ValueError(f"{label} run evidence line {number} is blank")
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{label} run evidence line {number} is invalid JSON: {exc.msg}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"{label} run evidence line {number} is not an object")
        events.append(value)
    return events


def _issues(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict) and isinstance(value.get("issues"), list):
        return [item for item in value["issues"] if isinstance(item, dict)]
    raise ValueError("Issue metadata must be a JSON list or an object with an issues list")


def _task_declaration(body: str) -> tuple[str | None, list[str]]:
    lines = body.splitlines()
    taskish = [line for line in lines if TASKISH_RE.match(line)]
    if not taskish:
        return None, []
    errors: list[str] = []
    if len(taskish) != 1:
        errors.append("PR body must contain exactly one Task: TASK-### line when it declares task work")
        return None, errors
    match = TASK_LINE_RE.fullmatch(taskish[0])
    if not match:
        errors.append("PR Task line must be exactly `Task: TASK-###`")
        return None, errors
    return match.group(1), errors


def _issue_reference(body: str, expected_verb: str, expected_number: int) -> list[str]:
    issueish = [line for line in body.splitlines() if ISSUEISH_RE.match(line)]
    if len(issueish) != 1:
        return ["tracked PR must contain exactly one Issue line (`Closes #N` or `Refs #N`)"]
    match = ISSUE_LINE_RE.fullmatch(issueish[0])
    if not match:
        return ["tracked PR Issue line must be exactly `Closes #N` or `Refs #N`"]
    if match.group("verb") != expected_verb or int(match.group("number")) != expected_number:
        return [f"tracked PR must use exactly `{expected_verb} #{expected_number}` for this checkpoint"]
    return []


def _gate_evidence(task: Task) -> tuple[str | None, str | None, list[str]]:
    commands = COMMAND_RE.findall(task.gate)
    if len(commands) != 1:
        return None, None, [f"{task.task_id} Gate / evidence needs exactly one backticked local command"]
    evidence = COMMAND_RE.sub("", task.gate)
    match = RESULT_RE.search(evidence)
    if not match or not match.group("result").strip():
        return commands[0], None, [f"{task.task_id} Gate / evidence needs an explicit factual `result:` outside the command"]
    return commands[0], match.group("result").strip(), []


def _checkpoint_event(
    base_events: list[dict[str, Any]],
    head_events: list[dict[str, Any]],
    task: Task,
    branch: str,
    command: str,
    result: str,
) -> list[str]:
    if len(head_events) != len(base_events) + 1 or head_events[: len(base_events)] != base_events:
        return ["run evidence must preserve every base event and append exactly one new event"]
    event = head_events[-1]
    errors: list[str] = []
    if event.get("type") != "task_checkpoint" or event.get("task_id") != task.task_id:
        errors.append(f"appended event must be a task_checkpoint for {task.task_id}")
    checkpoint = event.get("checkpoint")
    if not isinstance(checkpoint, dict):
        errors.append("appended task_checkpoint must include structured checkpoint fields")
        return errors
    expected = {
        "status": task.status,
        "work_ref": branch,
        "command": command,
        "result": result,
    }
    for key, value in expected.items():
        if checkpoint.get(key) != value:
            errors.append(f"appended checkpoint {key} must match the reconciled task evidence")
    if not isinstance(event.get("source"), str) or not event["source"].strip() or checkpoint.get("source") != event["source"]:
        errors.append("appended checkpoint source must be a non-empty structured fact matching event source")
    return errors


def _open_marked_issue(issues: list[dict[str, Any]], marker: str) -> tuple[dict[str, Any] | None, list[str]]:
    matches = [
        issue
        for issue in issues
        if str(issue.get("state", "")).lower() == "open" and marker in str(issue.get("body") or "")
    ]
    if len(matches) != 1:
        return None, [f"expected exactly one open same-repository Issue carrying {marker}; found {len(matches)}"]
    if not isinstance(matches[0].get("number"), int):
        return None, ["marked open Issue metadata lacks a numeric Issue number"]
    return matches[0], []


def validate(
    *,
    base_plan: str,
    head_plan: str,
    base_ledger: str,
    head_ledger: str,
    pr: PrMetadata,
    issues: list[dict[str, Any]],
) -> list[str]:
    declared_task, declaration_errors = _task_declaration(pr.body)
    if declaration_errors:
        return declaration_errors
    if declared_task is None:
        return []  # Intentional low-friction policy: a PR without Task: is untracked.

    errors: list[str] = []
    if base_plan == head_plan:
        errors.append("declared task PR must change docs/implementation-plan.md")
    if base_ledger == head_ledger:
        errors.append("declared task PR must change docs/run-evidence.jsonl")
    try:
        base_tasks = _tasks(base_plan, "base")
        head_tasks = _tasks(head_plan, "head")
        run_id = _run_id(head_plan)
        base_events = _events(base_ledger, "base")
        head_events = _events(head_ledger, "head")
    except ValueError as exc:
        return errors + [str(exc)]
    if declared_task not in base_tasks or declared_task not in head_tasks:
        return errors + [f"declared {declared_task} must exist in both base and head plans"]
    base_task = base_tasks[declared_task]
    head_task = head_tasks[declared_task]
    valid_transition = (
        head_task.status in {"done", "blocked"} and head_task.status != base_task.status
    ) or (
        base_task.status == "done" and head_task.status in {"ready", "in_progress", "blocked"}
    )
    if not valid_transition:
        errors.append(
            f"{declared_task} must change to done/blocked, or repair done to ready/in_progress/blocked"
        )
    if head_task.work_ref != pr.branch:
        errors.append(f"{declared_task} Work ref must equal the current PR branch {pr.branch!r}")
    command, result, gate_errors = _gate_evidence(head_task)
    errors.extend(gate_errors)
    if head_task.status == "done" and (result is None or result.upper() != "PASS"):
        errors.append(f"{declared_task} done checkpoint requires `result: PASS`")
    if command is not None and result is not None:
        errors.extend(_checkpoint_event(base_events, head_events, head_task, pr.branch, command, result))
    marker = f"<!-- fmd-task:{run_id}:{declared_task} -->"
    issue, issue_errors = _open_marked_issue(issues, marker)
    errors.extend(issue_errors)
    if issue is not None:
        expected_verb = "Closes" if head_task.status == "done" else "Refs"
        errors.extend(_issue_reference(pr.body, expected_verb, int(issue["number"])))
    return errors


def _fixture_plan(status: str, work_ref: str, gate: str) -> str:
    return f"""# Plan

**Run ID:** `RUN-TEST-001`

| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |
|----|----|----|----|----|----|----|----|
| TASK-001 | checkpoint guard; infra | — | A | fmd/tools | {work_ref} | {status} | {gate} |
"""


def _fixture_event(status: str, branch: str, command: str, result: str) -> str:
    return json.dumps(
        {
            "id": "EVT-002",
            "type": "task_checkpoint",
            "task_id": "TASK-001",
            "source": "test",
            "checkpoint": {
                "status": status,
                "work_ref": branch,
                "command": command,
                "result": result,
                "source": "test",
            },
        },
        sort_keys=True,
    ) + "\n"


def _validate_fixture(base_status: str, head_status: str, result: str, body: str) -> list[str]:
    branch = "task/TASK-001-guard"
    command = "python3 fmd/tools/check-tracked-pr.py --self-test"
    base_gate = "`python3 old.py` · result: PASS" if base_status == "done" else "`python3 old.py`"
    base_plan = _fixture_plan(base_status, "old-branch", base_gate)
    head_plan = _fixture_plan(head_status, branch, f"`{command}` · result: {result}")
    base_ledger = json.dumps({"id": "EVT-001", "type": "fmd_started"}) + "\n"
    head_ledger = base_ledger + _fixture_event(head_status, branch, command, result)
    marker = "<!-- fmd-task:RUN-TEST-001:TASK-001 -->"
    issues = [{"number": 35, "state": "OPEN", "body": marker}]
    return validate(
        base_plan=base_plan,
        head_plan=head_plan,
        base_ledger=base_ledger,
        head_ledger=head_ledger,
        pr=PrMetadata(body=body, branch=branch),
        issues=issues,
    )


def self_test() -> int:
    failures: list[str] = []
    valid_cases = {
        "done": ("in_progress", "done", "PASS", "Task: TASK-001\nCloses #35\n"),
        "blocked": ("in_progress", "blocked", "BLOCKED: upstream dependency unfinished", "Task: TASK-001\nRefs #35\n"),
        "repair": ("done", "in_progress", "REOPENED after review evidence", "Task: TASK-001\nRefs #35\n"),
    }
    for name, values in valid_cases.items():
        errors = _validate_fixture(*values)
        if errors:
            failures.append(f"valid {name} fixture rejected: {'; '.join(errors)}")

    done_values = valid_cases["done"]
    invalid_bodies = {
        "duplicate Task": "Task: TASK-001\nTask: TASK-001\nCloses #35\n",
        "malformed Task": "Task: task-001\nCloses #35\n",
        "wrong Issue verb": "Task: TASK-001\nRefs #35\n",
        "duplicate Issue": "Task: TASK-001\nCloses #35\nRefs #35\n",
    }
    for name, body in invalid_bodies.items():
        if not _validate_fixture(done_values[0], done_values[1], done_values[2], body):
            failures.append(f"invalid {name} fixture was accepted")

    # An intentionally untracked PR has no Task line and must pass regardless of its body.
    branch = "task/TASK-001-guard"
    if validate(
        base_plan="not a plan",
        head_plan="also not a plan",
        base_ledger="",
        head_ledger="",
        pr=PrMetadata(body="ordinary untracked documentation update\n", branch=branch),
        issues=[],
    ):
        failures.append("untracked PR was rejected")

    # Mutate a valid done fixture to cover each required evidence boundary.
    command = "python3 fmd/tools/check-tracked-pr.py --self-test"
    base_plan = _fixture_plan("in_progress", "old-branch", "`python3 old.py`")
    head_plan = _fixture_plan("done", branch, f"`{command}` · result: PASS")
    base_ledger = json.dumps({"id": "EVT-001", "type": "fmd_started"}) + "\n"
    head_ledger = base_ledger + _fixture_event("done", branch, command, "PASS")
    marker = "<!-- fmd-task:RUN-TEST-001:TASK-001 -->"
    fixture_pr = PrMetadata(body="Task: TASK-001\nCloses #35\n", branch=branch)
    cases = {
        "unchanged task": dict(head_plan=base_plan, head_ledger=head_ledger),
        "invalid plan": dict(head_plan=head_plan.replace("| done |", "| in_review |", 1)),
        "missing branch": dict(head_plan=head_plan.replace(branch, "other-branch", 1)),
        "missing evidence": dict(head_plan=head_plan.replace(f"`{command}` · result: PASS", "gate evidence unavailable", 1)),
        "missing event": dict(head_ledger=base_ledger),
        "closed Issue": dict(issues=[{"number": 35, "state": "CLOSED", "body": marker}]),
        "unmarked Issue": dict(issues=[{"number": 35, "state": "OPEN", "body": "human issue"}]),
    }
    for name, changes in cases.items():
        errors = validate(
            base_plan=changes.get("base_plan", base_plan),
            head_plan=changes.get("head_plan", head_plan),
            base_ledger=changes.get("base_ledger", base_ledger),
            head_ledger=changes.get("head_ledger", head_ledger),
            pr=fixture_pr,
            issues=changes.get("issues", [{"number": 35, "state": "OPEN", "body": marker}]),
        )
        if not errors:
            failures.append(f"invalid {name} fixture was accepted")

    if failures:
        print("SELF-TEST FAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("SELF-TEST PASS: done/blocked/repair paths, declaration and Issue syntax, head-plan, evidence, event, and Issue guards")
    return 0


def _metadata(args: argparse.Namespace) -> PrMetadata:
    if args.pr_event:
        try:
            event = json.loads(_read(args.pr_event))
            pull_request = event["pull_request"]
            body = pull_request.get("body") or ""
            branch = pull_request["head"]["ref"]
        except (KeyError, TypeError, json.JSONDecodeError) as exc:
            raise ValueError("--pr-event must be a GitHub pull_request event JSON file") from exc
        if not isinstance(body, str) or not isinstance(branch, str) or not branch:
            raise ValueError("--pr-event lacks a PR body or head branch")
        return PrMetadata(body=body, branch=branch)
    if args.pr_body_file and args.branch:
        return PrMetadata(body=_read(args.pr_body_file), branch=args.branch)
    raise ValueError("provide --pr-event, or both --pr-body-file and --branch")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-plan", type=Path)
    parser.add_argument("--head-plan", type=Path)
    parser.add_argument("--base-ledger", type=Path)
    parser.add_argument("--head-ledger", type=Path)
    parser.add_argument("--issues-json", type=Path)
    parser.add_argument("--pr-event", type=Path, help="GitHub pull_request event JSON")
    parser.add_argument("--pr-body-file", type=Path, help="local PR body fixture; requires --branch")
    parser.add_argument("--branch", help="current PR branch for --pr-body-file")
    parser.add_argument("--self-test", action="store_true", help="run deterministic offline fixtures")
    args = parser.parse_args(argv)
    if args.self_test:
        return self_test()
    required = (args.base_plan, args.head_plan, args.base_ledger, args.head_ledger, args.issues_json)
    if any(value is None for value in required):
        parser.error("--base-plan, --head-plan, --base-ledger, --head-ledger, and --issues-json are required")
    try:
        errors = validate(
            base_plan=_read(args.base_plan),
            head_plan=_read(args.head_plan),
            base_ledger=_read(args.base_ledger),
            head_ledger=_read(args.head_ledger),
            pr=_metadata(args),
            issues=_issues(json.loads(_read(args.issues_json))),
        )
    except ValueError as exc:
        print(f"REJECT: {exc}", file=sys.stderr)
        return 1
    if errors:
        print("REJECT: tracked task checkpoint failed")
        for error in errors:
            print(f"  - {error}")
        return 1
    print("APPROVE: PR is intentionally untracked or its declared task checkpoint is complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
