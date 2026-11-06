#!/usr/bin/env python3
"""Append one fact-only event to docs/run-evidence.jsonl (stdlib only)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


EVENT_TYPES = {
    "run_started", "ideaforge_completed", "fmd_started", "fmd_completed", "task_checkpoint",
    "first_working_slice", "spec_caused_rework", "spec_prevented_rework", "architecture_pivot",
    "demo_result", "judge_feedback", "user_feedback", "run_closed",
}
EVENT_ID_RE = re.compile(r"EVT-\d{3,}$")
TASK_ID_RE = re.compile(r"TASK-\d{3,}$")
FACT_LEVELS = {"decided", "code-pinned", "configured", "deployed", "smoke-verified", "historical"}
CHECKPOINT_STATUS = {"ready", "in_progress", "blocked", "done", "cut"}


def load_existing(path: Path) -> list[dict]:
    if not path.exists():
        return []
    events: list[dict] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_number}: invalid JSON: {exc.msg}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"{path}:{line_number}: each event must be a JSON object")
        events.append(value)
    return events


def next_event_id(events: list[dict]) -> str:
    highest = 0
    for event in events:
        match = re.fullmatch(r"EVT-(\d+)", str(event.get("id", "")))
        if match:
            highest = max(highest, int(match.group(1)))
    return f"EVT-{highest + 1:03d}"


def parse_doc(value: str) -> dict[str, str]:
    if "::" not in value:
        raise ValueError("--doc must use PATH::USED_FOR")
    path, used_for = (part.strip() for part in value.split("::", 1))
    if not path or not used_for:
        raise ValueError("--doc must use non-empty PATH::USED_FOR")
    return {"path": path, "used_for": used_for}


def parse_fact_change(raw: str | None) -> dict | None:
    if raw is None:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"--fact-change must be JSON: {exc.msg}") from exc
    required = {"old", "new", "evidence_level", "canonical_owners", "propagation_targets", "historical_exceptions", "term_sweep", "closeout"}
    if not isinstance(value, dict) or required - value.keys():
        raise ValueError("--fact-change needs old, new, evidence_level, canonical_owners, propagation_targets, historical_exceptions, term_sweep, and closeout")
    if value["evidence_level"] not in FACT_LEVELS:
        raise ValueError("--fact-change evidence_level is invalid")
    return value


def append_event(args: argparse.Namespace) -> int:
    path = args.ledger
    try:
        events = load_existing(path)
        event_id = args.id or next_event_id(events)
        if not EVENT_ID_RE.fullmatch(event_id):
            raise ValueError("--id must match EVT-###")
        if any(event.get("id") == event_id for event in events):
            raise ValueError(f"duplicate event id {event_id}")
        if args.type not in EVENT_TYPES:
            raise ValueError("unknown event type")
        if args.task_id and not TASK_ID_RE.fullmatch(args.task_id):
            raise ValueError("--task-id must match TASK-###")
        checkpoint_values = (
            args.checkpoint_status,
            args.checkpoint_work_ref,
            args.checkpoint_command,
            args.checkpoint_result,
        )
        if args.type == "task_checkpoint":
            if not args.task_id:
                raise ValueError("task_checkpoint requires --task-id")
            if any(value is None or not value.strip() for value in checkpoint_values):
                raise ValueError(
                    "task_checkpoint requires --checkpoint-status, --checkpoint-work-ref, "
                    "--checkpoint-command, and --checkpoint-result"
                )
            if args.checkpoint_status not in CHECKPOINT_STATUS:
                raise ValueError("--checkpoint-status is invalid")
        elif any(value is not None for value in checkpoint_values):
            raise ValueError("checkpoint fields are valid only for --type task_checkpoint")
        fact_change = parse_fact_change(args.fact_change)
        event = {
            "id": event_id,
            "at": args.at or datetime.now(timezone.utc).isoformat(),
            "type": args.type,
            "task_id": args.task_id,
            "source": args.source,
            "evidence_ref": args.evidence_ref,
            "docs_consulted": [parse_doc(value) for value in args.doc],
            "rework": args.rework,
        }
        if fact_change is not None:
            event["fact_change"] = fact_change
        if args.type == "task_checkpoint":
            event["checkpoint"] = {
                "status": args.checkpoint_status,
                "work_ref": args.checkpoint_work_ref,
                "command": args.checkpoint_command,
                "result": args.checkpoint_result,
                "source": args.source,
            }
        for key, value in (("outcome", args.outcome), ("demo_status", args.demo_status), ("feedback_status", args.feedback_status)):
            if value is not None:
                event[key] = value
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, sort_keys=True) + "\n")
    except ValueError as exc:
        print(f"REJECT: {exc}", file=sys.stderr)
        return 2
    print(f"RECORDED: {event_id} {args.type} → {path}")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, default=Path("docs/run-evidence.jsonl"))
    parser.add_argument("--type", choices=sorted(EVENT_TYPES), required=True)
    parser.add_argument("--source", required=True, help="human, PR, CI, test, demo, or other observed source")
    parser.add_argument("--evidence-ref", required=True, help="URL, commit, command result, artifact, or honest unknown")
    parser.add_argument("--id")
    parser.add_argument("--at", help="ISO-8601 timestamp; defaults to current UTC time")
    parser.add_argument("--task-id")
    parser.add_argument("--doc", action="append", default=[], help="PATH::USED_FOR; repeatable")
    parser.add_argument("--rework", default=None, help="observed rework, none, or unknown")
    parser.add_argument("--fact-change", help="JSON fact-change object for architecture pivots")
    parser.add_argument("--outcome", help="used on run_closed: shipped, submitted, demoed, abandoned, or unknown")
    parser.add_argument("--demo-status", help="used on run_closed: pass, partial, fail, not-run, or unknown")
    parser.add_argument("--feedback-status", help="used on run_closed: captured, none, or unknown")
    parser.add_argument("--checkpoint-status", help="task_checkpoint status: ready, in_progress, blocked, done, or cut")
    parser.add_argument("--checkpoint-work-ref", help="task_checkpoint branch, PR, or equivalent work reference")
    parser.add_argument("--checkpoint-command", help="task_checkpoint exact local command, without Markdown backticks")
    parser.add_argument("--checkpoint-result", help="task_checkpoint factual observed result, for example PASS or BLOCKED")
    return append_event(parser.parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
