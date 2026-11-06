#!/usr/bin/env python3
"""Project an FMD implementation plan into GitHub Issues and a GitHub Project.

The Markdown plan remains canonical. This tool projects one Issue per TASK-###, with a stable
HTML marker, into a GitHub Project. It never changes the Markdown plan from GitHub state.

Default behaviour is read-only: validate the plan, inventory GitHub, and print a mutation
manifest. Remote changes require --apply. The tool needs the GitHub CLI (gh) authenticated with
repository issue access and the `project` scope. It synchronizes both the Project's built-in
`Status` field and the custom `Plan Status` field; the Project owner configures built-in options
once, outside this tool.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CHECKER_PATH = Path(__file__).with_name("check-implementation-plan.py")
CHECKER_SPEC = importlib.util.spec_from_file_location("fmd_implementation_plan_checker", CHECKER_PATH)
if CHECKER_SPEC is None or CHECKER_SPEC.loader is None:  # pragma: no cover - impossible in a valid kit
    raise RuntimeError(f"cannot load FMD plan checker from {CHECKER_PATH}")
CHECKER = importlib.util.module_from_spec(CHECKER_SPEC)
sys.modules[CHECKER_SPEC.name] = CHECKER
CHECKER_SPEC.loader.exec_module(CHECKER)
Task = CHECKER.Task
compute_waves = CHECKER.compute_waves
parse_tasks = CHECKER.parse_tasks
validate_text = CHECKER.validate_text


MARKER_RE = re.compile(r"<!-- fmd-task:(?P<run>RUN-[A-Za-z0-9-]+):(?P<task>TASK-\d{3}) -->")
BLOCK_RE = re.compile(r"<!-- fmd-sync:start -->.*?<!-- fmd-sync:end -->", re.DOTALL)
RUN_ID_LINE_RE = re.compile(r"^\*\*Run ID:\*\*\s*`(?P<run>RUN-[A-Za-z0-9-]+)`\s*$", re.MULTILINE)
MODE_LINE_RE = re.compile(r"^\*\*GitHub delivery mode:\*\*\s*`(?P<mode>[^`]+)`\s*$", re.MULTILINE)
PLAN_STATUS_MAP = {
    "ready": "Ready",
    "in_progress": "In Progress",
    "blocked": "Blocked",
    "done": "Done",
    "cut": "Cut",
}
PROJECT_STATUS_MAP = {
    "ready": "Todo",
    "in_progress": "In Progress",
    "blocked": "Blocked",
    "done": "Done",
    "cut": "Cut",
}
BUILT_IN_STATUS_SPEC = ("Status", "SINGLE_SELECT", tuple(dict.fromkeys(PROJECT_STATUS_MAP.values())))
FIELD_SPECS = (
    ("Task ID", "TEXT", None),
    ("Run ID", "TEXT", None),
    ("Plan Status", "SINGLE_SELECT", tuple(PLAN_STATUS_MAP.values())),
    ("Wave", "NUMBER", None),
)
REQUIRED_FIELD_SPECS = (BUILT_IN_STATUS_SPEC, *FIELD_SPECS)


class GitHubError(RuntimeError):
    """A GitHub CLI command could not complete."""


@dataclass(frozen=True)
class TaskProjection:
    task: Task
    run_id: str
    wave: int
    title: str
    body: str


def run_gh(args: list[str]) -> str:
    """Run gh and return stdout; keep credentials and command output out of tracebacks."""
    command = ["gh", *args]
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or "no diagnostic returned"
        raise GitHubError(f"gh {' '.join(args[:3])} failed: {detail}")
    return result.stdout


def gh_json(args: list[str]) -> Any:
    output = run_gh(args)
    try:
        return json.loads(output)
    except json.JSONDecodeError as exc:
        raise GitHubError(f"gh returned invalid JSON for {' '.join(args[:3])}: {exc}") from exc


def collection(value: Any, key: str) -> list[dict[str, Any]]:
    """Accept the list and object shapes emitted by different gh project commands."""
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        nested = value.get(key, [])
        if isinstance(nested, list):
            return [item for item in nested if isinstance(item, dict)]
    return []


def issue_marker(run_id: str, task_id: str) -> str:
    return f"<!-- fmd-task:{run_id}:{task_id} -->"


def summary(outcome: str) -> str:
    value = outcome.split(";", 1)[0].strip()
    return value[:210].rstrip() or "implementation task"


def render_generated_block(task: Task, wave: int) -> str:
    dependencies = ", ".join(task.dependencies) if task.dependencies else "None"
    return "\n".join(
        [
            "<!-- fmd-sync:start -->",
            "## FMD task projection",
            "",
            f"- **Task:** `{task.task_id}`",
            f"- **Wave:** `{wave}`",
            f"- **Outcome / trace:** {task.outcome}",
            f"- **Depends on:** {dependencies}",
            f"- **Owner:** {task.owner}",
            f"- **Write scope:** {task.write_scope}",
            f"- **Work ref:** {task.work_ref}",
            f"- **Plan status:** `{task.status}`",
            f"- **Gate / evidence:** {task.gate}",
            "",
            "Generated from `docs/implementation-plan.md`. The Markdown plan is canonical. "
            "The synchronizer owns only this block; add human discussion below it or in comments.",
            "<!-- fmd-sync:end -->",
        ]
    )


def render_issue_body(run_id: str, task: Task, wave: int, existing: str | None = None) -> str:
    """Replace only FMD's generated block and preserve the rest of an Issue body."""
    marker = issue_marker(run_id, task.task_id)
    block = render_generated_block(task, wave)
    if existing is None:
        return f"{marker}\n{block}\n\n<!-- Add human notes below. -->\n"
    if marker not in existing:
        # An accidental marker collision must not overwrite a human-authored Issue body.
        return f"{marker}\n{block}\n\n{existing.lstrip()}"
    if BLOCK_RE.search(existing):
        return BLOCK_RE.sub(block, existing, count=1)
    return existing.replace(marker, f"{marker}\n{block}", 1)


def load_tasks(plan: Path) -> tuple[list[Task], dict[str, int]]:
    try:
        text = plan.read_text(encoding="utf-8")
    except OSError as exc:
        raise ValueError(f"cannot read plan {plan}: {exc}") from exc
    errors = validate_text(text)
    if errors:
        joined = "\n  - ".join(errors)
        raise ValueError(f"plan integrity rejected:\n  - {joined}")
    tasks, parse_errors = parse_tasks(text)
    if parse_errors:
        raise ValueError("plan parser rejected an otherwise valid plan: " + "; ".join(parse_errors))
    waves = compute_waves({task.task_id: task for task in tasks})
    wave_by_task = {task_id: wave for wave, task_ids in waves.items() for task_id in task_ids}
    return tasks, wave_by_task


def load_delivery_state(plan: Path) -> tuple[str, str]:
    """Read the lead-owned run identity and activation state from canonical Markdown."""
    try:
        text = plan.read_text(encoding="utf-8")
    except OSError as exc:
        raise ValueError(f"cannot read plan {plan}: {exc}") from exc
    run_match = RUN_ID_LINE_RE.search(text)
    mode_match = MODE_LINE_RE.search(text)
    if not run_match:
        raise ValueError("implementation plan needs a concrete **Run ID:** `RUN-...` before GitHub projection")
    if not mode_match:
        raise ValueError("implementation plan needs a concrete **GitHub delivery mode:** value")
    mode = mode_match.group("mode").strip().lower()
    if mode not in {"not configured", "previewed", "active", "suspended", "closed"}:
        raise ValueError("GitHub delivery mode must be not configured, previewed, active, suspended, or closed")
    return run_match.group("run"), mode


def project_tasks(run_id: str, tasks: list[Task], waves: dict[str, int], existing_issues: list[dict[str, Any]]) -> list[TaskProjection]:
    issues_by_marker: dict[str, dict[str, Any]] = {}
    for issue in existing_issues:
        body = issue.get("body") or ""
        for match in MARKER_RE.finditer(body):
            marker = match.group(0)
            if marker in issues_by_marker:
                raise ValueError(f"GitHub has duplicate Issues carrying {marker}")
            issues_by_marker[marker] = issue

    projections = []
    for task in tasks:
        marker = issue_marker(run_id, task.task_id)
        existing = issues_by_marker.get(marker)
        body = render_issue_body(run_id, task, waves[task.task_id], existing.get("body") if existing else None)
        projections.append(
            TaskProjection(
                task=task,
                run_id=run_id,
                wave=waves[task.task_id],
                title=f"[{task.task_id}] {summary(task.outcome)}",
                body=body,
            )
        )
    return projections


def select_tasks(tasks: list[Task], requested_ids: list[str] | None) -> list[Task]:
    """Select a repeatable, explicit subset without weakening full-plan validation."""
    if not requested_ids:
        return tasks
    requested = set(requested_ids)
    if len(requested) != len(requested_ids):
        raise ValueError("--task may name each TASK-### only once")
    malformed = [task_id for task_id in requested_ids if not re.fullmatch(r"TASK-\d{3}", task_id)]
    if malformed:
        raise ValueError("--task must use TASK-### IDs: " + ", ".join(malformed))
    by_id = {task.task_id: task for task in tasks}
    missing = [task_id for task_id in requested_ids if task_id not in by_id]
    if missing:
        raise ValueError("--task is not present in the canonical plan: " + ", ".join(missing))
    return [task for task in tasks if task.task_id in requested]


def list_issues(repo: str) -> list[dict[str, Any]]:
    return collection(
        gh_json(["issue", "list", "--repo", repo, "--state", "all", "--limit", "1000", "--json", "number,title,body,url"]),
        "issues",
    )


def get_project(owner: str, number: int) -> dict[str, Any]:
    value = gh_json(["project", "view", str(number), "--owner", owner, "--format", "json"])
    if not isinstance(value, dict):
        raise GitHubError("gh project view did not return a project object")
    return value


def list_project_fields(owner: str, number: int) -> list[dict[str, Any]]:
    return collection(
        gh_json(["project", "field-list", str(number), "--owner", owner, "--limit", "100", "--format", "json"]),
        "fields",
    )


def list_project_items(owner: str, number: int) -> list[dict[str, Any]]:
    return collection(
        gh_json(["project", "item-list", str(number), "--owner", owner, "--limit", "1000", "--format", "json"]),
        "items",
    )


def list_linked_repositories(project: dict[str, Any]) -> list[str]:
    project_id = project.get("id")
    if not isinstance(project_id, str):
        raise GitHubError("Project JSON lacks a node id needed to inspect repository links")
    value = gh_json(
        [
            "api",
            "graphql",
            "-f",
            "query=query($id:ID!){node(id:$id){... on ProjectV2{repositories(first:100){nodes{nameWithOwner}}}}}",
            "-F",
            f"id={project_id}",
        ]
    )
    nodes = value.get("data", {}).get("node", {}).get("repositories", {}).get("nodes", [])
    return sorted(
        str(node["nameWithOwner"])
        for node in nodes
        if isinstance(node, dict) and isinstance(node.get("nameWithOwner"), str)
    )


def item_issue_url(item: dict[str, Any]) -> str | None:
    content = item.get("content")
    if isinstance(content, dict):
        url = content.get("url")
        if isinstance(url, str):
            return url
    url = item.get("url")
    return url if isinstance(url, str) and "/issues/" in url else None


def project_item_field_value(item: dict[str, Any], field_name: str) -> Any:
    """Read a custom-field value from both CLI field-name serializations."""
    if field_name in item:
        return item[field_name]
    cli_key = field_name[:1].lower() + field_name[1:]
    return item.get(cli_key)


def project_field_map(fields: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(field.get("name")): field for field in fields if field.get("name")}


def field_matches_data_type(field: dict[str, Any], expected: str) -> bool:
    """Accept both GitHub CLI field shapes.

    Some ``gh project field-list --format json`` versions expose GraphQL's
    ``dataType`` while others expose only a concrete ``type``. Generic Project
    fields cover both text and number values, so their names remain the
    authoritative contract after this synchronizer creates them.
    """
    actual = str(field.get("dataType", "")).upper()
    if actual:
        return actual in {expected, expected.title()}
    concrete_type = str(field.get("type", ""))
    if expected == "SINGLE_SELECT":
        return concrete_type == "ProjectV2SingleSelectField"
    return expected in {"TEXT", "NUMBER"} and concrete_type == "ProjectV2Field"


def required_field_manifest(fields: list[dict[str, Any]]) -> list[str]:
    by_name = project_field_map(fields)
    operations: list[str] = []
    for name, data_type, options in REQUIRED_FIELD_SPECS:
        field = by_name.get(name)
        if field is None:
            if name == "Status":
                operations.append(
                    "BLOCKED built-in Project field 'Status' is missing; a Project owner must configure "
                    f"options {','.join(options or ())} before sync can apply"
                )
                continue
            detail = f"CREATE Project field {name!r} ({data_type})"
            if options:
                detail += f" options={','.join(options)}"
            operations.append(detail)
            continue
        if not field_matches_data_type(field, data_type):
            reported_type = field.get("dataType") or field.get("type")
            operations.append(f"BLOCKED Project field {name!r}: expected {data_type}, found {reported_type}")
            continue
        if options:
            actual = {str(option.get("name")) for option in field.get("options", []) if isinstance(option, dict)}
            missing = [option for option in options if option not in actual]
            if missing:
                operations.append(f"BLOCKED Project field {name!r}: missing options {', '.join(missing)}")
    return operations


def ensure_fields(owner: str, number: int, fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_name = project_field_map(fields)
    blocked = [operation for operation in required_field_manifest(fields) if operation.startswith("BLOCKED")]
    if blocked:
        raise GitHubError("\n".join(blocked))
    for name, data_type, options in FIELD_SPECS:
        if name in by_name:
            continue
        args = ["project", "field-create", str(number), "--owner", owner, "--name", name, "--data-type", data_type]
        if options:
            args.extend(["--single-select-options", ",".join(options)])
        run_gh(args)
    return list_project_fields(owner, number)


def create_project(owner: str, title: str) -> int:
    value = gh_json(["project", "create", "--owner", owner, "--title", title, "--format", "json"])
    if not isinstance(value, dict) or not isinstance(value.get("number"), int):
        raise GitHubError("gh project create did not return a project number")
    return int(value["number"])


def operation_manifest(
    projections: list[TaskProjection],
    issues: list[dict[str, Any]],
    project_items: list[dict[str, Any]],
    fields: list[dict[str, Any]],
    project_exists: bool,
    create_title: str | None,
    repo: str,
    linked_repositories: list[str],
    project_is_public: bool,
) -> list[str]:
    by_marker = {
        match.group(0): issue
        for issue in issues
        for match in MARKER_RE.finditer(issue.get("body") or "")
    }
    issue_urls_in_project = {url for item in project_items if (url := item_issue_url(item))}
    operations: list[str] = []
    if project_is_public:
        operations.append("BLOCKED GitHub Project must be private")
    if not project_exists:
        operations.append(f"CREATE GitHub Project {create_title!r}")
    other_links = [item for item in linked_repositories if item.lower() != repo.lower()]
    if other_links:
        operations.append(f"BLOCKED GitHub Project links non-GuidHer repositories: {', '.join(other_links)}")
    if repo.lower() not in {item.lower() for item in linked_repositories}:
        operations.append(f"LINK GitHub Project exclusively to {repo}")
    operations.extend(required_field_manifest(fields))
    for projection in projections:
        issue = by_marker.get(issue_marker(projection.run_id, projection.task.task_id))
        if issue is None:
            operations.append(f"CREATE Issue {projection.title}")
            operations.append(f"ADD {projection.task.task_id} Issue to Project")
        else:
            if issue.get("body") != projection.body:
                operations.append(f"UPDATE FMD block in Issue #{issue.get('number')} for {projection.task.task_id}")
            if issue.get("url") not in issue_urls_in_project:
                operations.append(f"ADD Issue #{issue.get('number')} to Project for {projection.task.task_id}")
        operations.append(
            f"SET Project fields for {projection.task.task_id}: "
            f"Status={PROJECT_STATUS_MAP[projection.task.status]!r}, "
            f"Plan Status={PLAN_STATUS_MAP[projection.task.status]!r}, Wave={projection.wave}"
        )
    return operations


def manifest_digest(
    projections: list[TaskProjection],
    issues: list[dict[str, Any]],
    project_items: list[dict[str, Any]],
    fields: list[dict[str, Any]],
    project_exists: bool,
    create_title: str | None,
    repo: str = "",
    linked_repositories: list[str] | None = None,
    project_is_public: bool = False,
) -> str:
    """Bind an apply to the exact previewed desired state, not a prose summary."""
    payload = {
        "project_exists": project_exists,
        "create_title": create_title,
        "repo": repo,
        "linked_repositories": linked_repositories or [],
        "project_is_public": project_is_public,
        "fields": fields,
        "issues": issues,
        "project_items": project_items,
        "projections": [
            {
                "run_id": item.run_id,
                "task_id": item.task.task_id,
                "title": item.title,
                "body": item.body,
                "wave": item.wave,
                "status": item.task.status,
            }
            for item in projections
        ],
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def apply_projection(
    *,
    repo: str,
    owner: str,
    number: int,
    projections: list[TaskProjection],
    issues: list[dict[str, Any]],
    fields: list[dict[str, Any]],
    project: dict[str, Any],
) -> None:
    issues_by_marker = {
        match.group(0): issue
        for issue in issues
        for match in MARKER_RE.finditer(issue.get("body") or "")
    }
    for projection in projections:
        marker = issue_marker(projection.run_id, projection.task.task_id)
        issue = issues_by_marker.get(marker)
        if issue is None:
            url = run_gh(["issue", "create", "--repo", repo, "--title", projection.title, "--body", projection.body]).strip()
            if not url:
                raise GitHubError(f"Issue creation for {projection.task.task_id} returned no URL")
        elif issue.get("body") != projection.body:
            run_gh(
                [
                    "issue",
                    "edit",
                    str(issue["number"]),
                    "--repo",
                    repo,
                    "--title",
                    issue.get("title") or projection.title,
                    "--body",
                    projection.body,
                ]
            )

    issues = list_issues(repo)
    issues_by_marker = {
        match.group(0): issue
        for issue in issues
        for match in MARKER_RE.finditer(issue.get("body") or "")
    }
    items = list_project_items(owner, number)
    item_urls = {url for item in items if (url := item_issue_url(item))}
    for projection in projections:
        issue = issues_by_marker[issue_marker(projection.run_id, projection.task.task_id)]
        if issue["url"] not in item_urls:
            run_gh(["project", "item-add", str(number), "--owner", owner, "--url", issue["url"]])

    items = list_project_items(owner, number)
    items_by_url = {url: item for item in items if (url := item_issue_url(item))}
    fields_by_name = project_field_map(fields)
    project_id = project.get("id")
    if not isinstance(project_id, str):
        raise GitHubError("Project JSON lacks a node id needed to update fields")
    status_options = {
        str(option.get("name")): str(option.get("id"))
        for option in fields_by_name["Status"].get("options", [])
        if isinstance(option, dict) and option.get("name") and option.get("id")
    }
    plan_status_options = {
        str(option.get("name")): str(option.get("id"))
        for option in fields_by_name["Plan Status"].get("options", [])
        if isinstance(option, dict) and option.get("name") and option.get("id")
    }
    for projection in projections:
        issue = issues_by_marker[issue_marker(projection.run_id, projection.task.task_id)]
        item = items_by_url.get(issue["url"])
        item_id = item.get("id") if item else None
        if not isinstance(item_id, str):
            raise GitHubError(f"Project item for {projection.task.task_id} was not returned after add")
        for field_name, value_flag, value in (
            ("Status", "--single-select-option-id", status_options[PROJECT_STATUS_MAP[projection.task.status]]),
            ("Task ID", "--text", projection.task.task_id),
            ("Run ID", "--text", projection.run_id),
            ("Plan Status", "--single-select-option-id", plan_status_options[PLAN_STATUS_MAP[projection.task.status]]),
            ("Wave", "--number", str(projection.wave)),
        ):
            if field_name == "Status":
                expected_value = PROJECT_STATUS_MAP[projection.task.status]
            elif field_name == "Plan Status":
                expected_value = PLAN_STATUS_MAP[projection.task.status]
            else:
                expected_value = value
            current_value = project_item_field_value(item, field_name)
            if str(current_value) == str(expected_value):
                continue
            run_gh(
                [
                    "project",
                    "item-edit",
                    "--id",
                    item_id,
                    "--project-id",
                    project_id,
                    "--field-id",
                    str(fields_by_name[field_name]["id"]),
                    value_flag,
                    value,
                ]
            )


def self_test() -> int:
    fixture = """| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |
|----|-----------------|------------|-------|-------------|----------|--------|-----------------|
| TASK-001 | bootstrap; infra | — | Alex | src/ | — | ready | `npm test` |
| TASK-002 | core journey; F-001 | TASK-001 | Bea | src/core/ | — | blocked | TC-001 · `npm test -- core` |
"""
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as directory:
        plan = Path(directory) / "implementation-plan.md"
        plan.write_text(fixture, encoding="utf-8")
        try:
            tasks, waves = load_tasks(plan)
        except ValueError as exc:
            failures.append(f"valid fixture rejected: {exc}")
            tasks, waves = [], {}
        if waves != {"TASK-001": 0, "TASK-002": 1}:
            failures.append(f"unexpected task waves: {waves}")
        if tasks and [task.task_id for task in select_tasks(tasks, ["TASK-002"])] != ["TASK-002"]:
            failures.append("targeted task selection did not retain the requested task")
        for invalid_selection in (["TASK-999"], ["TASK-001", "TASK-001"], ["TASK-BAD"]):
            try:
                select_tasks(tasks, invalid_selection)
                failures.append(f"invalid task selection was accepted: {invalid_selection}")
            except ValueError:
                pass
        state_plan = Path(directory) / "state-plan.md"
        state_plan.write_text("**Run ID:** `RUN-TEST-001`\n\n**GitHub delivery mode:** `active`\n", encoding="utf-8")
        try:
            if load_delivery_state(state_plan) != ("RUN-TEST-001", "active"):
                failures.append("delivery-state parsing returned an unexpected value")
        except ValueError as exc:
            failures.append(f"delivery-state fixture rejected: {exc}")
        invalid_plan = Path(directory) / "invalid-implementation-plan.md"
        invalid_plan.write_text(fixture.replace("TASK-002", "TASK-BAD", 1), encoding="utf-8")
        try:
            load_tasks(invalid_plan)
            failures.append("malformed task ID fixture was accepted")
        except ValueError:
            pass
        if tasks:
            original = "<!-- fmd-task:RUN-TEST-001:TASK-001 -->\n<!-- fmd-sync:start -->old<!-- fmd-sync:end -->\n\nHuman note.\n"
            body = render_issue_body("RUN-TEST-001", tasks[0], waves["TASK-001"], original)
            if "Human note." not in body or "**Wave:** `0`" not in body:
                failures.append("generated-body replacement did not preserve human text or update the snapshot")
            if body.count("<!-- fmd-sync:start -->") != 1:
                failures.append("generated-body replacement produced duplicate managed blocks")
            projection = project_tasks("RUN-TEST-001", tasks, waves, [{"number": 7, "title": "Human title", "body": original, "url": "https://example.test/issues/7"}])
            operations = operation_manifest(
                projection,
                [{"number": 7, "title": "Human title", "body": original, "url": "https://example.test/issues/7"}],
                [],
                [],
                True,
                None,
                "example/GuidHer",
                ["example/GuidHer"],
                False,
            )
            if any("Human title" in operation or "title" in operation.lower() for operation in operations):
                failures.append("existing Issue title entered the managed mutation manifest")
            if not manifest_digest(projection, [], [], [], True, None):
                failures.append("manifest digest was empty")
        fields = [
            {"name": "Status", "dataType": "SINGLE_SELECT", "options": [{"name": item} for item in PROJECT_STATUS_MAP.values()]},
            {"name": "Task ID", "dataType": "TEXT"},
            {"name": "Run ID", "dataType": "TEXT"},
            {"name": "Plan Status", "dataType": "SINGLE_SELECT", "options": [{"name": item} for item in PLAN_STATUS_MAP.values()]},
            {"name": "Wave", "dataType": "NUMBER"},
        ]
        if required_field_manifest(fields):
            failures.append("complete field fixture was reported as needing changes")
        cli_fields = [
            {
                "name": "Status",
                "type": "ProjectV2SingleSelectField",
                "options": [{"name": item} for item in PROJECT_STATUS_MAP.values()],
            },
            {"name": "Task ID", "type": "ProjectV2Field"},
            {"name": "Run ID", "type": "ProjectV2Field"},
            {
                "name": "Plan Status",
                "type": "ProjectV2SingleSelectField",
                "options": [{"name": item} for item in PLAN_STATUS_MAP.values()],
            },
            {"name": "Wave", "type": "ProjectV2Field"},
        ]
        if required_field_manifest(cli_fields):
            failures.append("GitHub CLI field fixture was reported as needing changes")
        if project_item_field_value({"plan Status": "Ready"}, "Plan Status") != "Ready":
            failures.append("GitHub CLI item field-name fixture was not read")
        for status, project_value in PROJECT_STATUS_MAP.items():
            if status not in PLAN_STATUS_MAP or not project_value:
                failures.append(f"incomplete status mapping for {status}")
        mapping_projections = [
            TaskProjection(
                task=Task(
                    f"TASK-{index:03d}",
                    "status mapping; infra",
                    (),
                    "A",
                    f"scope/{status}",
                    "task/status-mapping",
                    status,
                    "`python3 check.py`",
                    index,
                ),
                run_id="RUN-TEST-001",
                wave=0,
                title=f"[{status}] status mapping",
                body="marker body",
            )
            for index, status in enumerate(PLAN_STATUS_MAP, 1)
        ]
        mapping_operations = operation_manifest(
            mapping_projections,
            [],
            [],
            fields,
            True,
            None,
            "example/GuidHer",
            ["example/GuidHer"],
            False,
        )
        for status in PLAN_STATUS_MAP:
            expected = (
                f"Status={PROJECT_STATUS_MAP[status]!r}, "
                f"Plan Status={PLAN_STATUS_MAP[status]!r}"
            )
            if not any(expected in operation for operation in mapping_operations):
                failures.append(f"dry-run manifest omitted both status fields for {status}")
        no_builtin_status = [field for field in fields if field["name"] != "Status"]
        if not any(item.startswith("BLOCKED built-in Project field 'Status'") for item in required_field_manifest(no_builtin_status)):
            failures.append("missing built-in Status field was not blocked")
    if failures:
        print("SELF-TEST FAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("SELF-TEST PASS: task selection, plan parsing, waves, managed Issue body preservation, and both status-field contracts")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, help="path to docs/implementation-plan.md")
    parser.add_argument("--run-id", help="immutable RUN-... identity from the implementation plan")
    parser.add_argument("--repo", help="GitHub repository as OWNER/REPO")
    parser.add_argument("--project-owner", help="GitHub user or organization owning the Project")
    parser.add_argument("--project-number", type=int, help="existing GitHub Project number")
    parser.add_argument("--create-project-title", help="create a new Project with this title on --apply")
    parser.add_argument("--task", action="append", default=[], help="TASK-### to project; repeatable, defaults to every task")
    parser.add_argument("--apply", action="store_true", help="perform the manifest's remote GitHub mutations")
    parser.add_argument("--expected-manifest-sha", help="SHA-256 printed by a reviewed preview; required with --apply")
    parser.add_argument("--self-test", action="store_true", help="run offline deterministic tests")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()
    if not all((args.plan, args.repo, args.project_owner, args.run_id)):
        parser.error("--plan, --run-id, --repo, and --project-owner are required")
    if not re.fullmatch(r"RUN-[A-Za-z0-9-]+", args.run_id):
        parser.error("--run-id must match RUN-<letters/numbers/hyphens>")
    if bool(args.project_number) == bool(args.create_project_title):
        parser.error("provide exactly one of --project-number or --create-project-title")
    if args.apply and shutil.which("gh") is None:
        print("REJECT: gh CLI is required for --apply", file=sys.stderr)
        return 2
    if args.apply and not args.expected_manifest_sha:
        parser.error("--apply requires --expected-manifest-sha from a reviewed preview")

    try:
        all_tasks, waves = load_tasks(args.plan)
        tasks = select_tasks(all_tasks, args.task)
        declared_run_id, delivery_mode = load_delivery_state(args.plan)
        if declared_run_id != args.run_id:
            raise ValueError(f"--run-id {args.run_id} does not match the canonical plan run ID {declared_run_id}")
        if args.apply and delivery_mode != "active":
            raise ValueError(f"GitHub delivery mode is {delivery_mode!r}; only an explicitly active run may apply remote mutations")
        project_exists = args.project_number is not None
        if project_exists:
            project = get_project(args.project_owner, args.project_number)
            fields = list_project_fields(args.project_owner, args.project_number)
            items = list_project_items(args.project_owner, args.project_number)
            linked_repositories = list_linked_repositories(project)
        else:
            project = {}
            fields = []
            items = []
            linked_repositories = []
        issues = list_issues(args.repo)
        projections = project_tasks(args.run_id, tasks, waves, issues)
        manifest = operation_manifest(
            projections,
            issues,
            items,
            fields,
            project_exists,
            args.create_project_title,
            args.repo,
            linked_repositories,
            project.get("public") is True,
        )
        digest = manifest_digest(
            projections,
            issues,
            items,
            fields,
            project_exists,
            args.create_project_title,
            args.repo,
            linked_repositories,
            project.get("public") is True,
        )
        print(
            f"PLAN INTEGRITY PASS: {args.plan} contains {len(all_tasks)} coherent TASK-### rows; "
            f"projecting {len(tasks)} selected row(s)"
        )
        print("GitHub mutation manifest (read-only preview):")
        for operation in manifest:
            print(f"  - {operation}")
        print(f"MANIFEST SHA256: {digest}")
        if not args.apply:
            print("PREVIEW ONLY: no GitHub mutations were made. Re-run with --apply after review.")
            return 0
        if args.expected_manifest_sha != digest:
            raise GitHubError("preview no longer matches the current plan/GitHub state; run a fresh preview before applying")
        blocked = [operation for operation in manifest if operation.startswith("BLOCKED")]
        if blocked:
            raise GitHubError("reviewed manifest contains blocked project configuration: " + "; ".join(blocked))

        if not project_exists:
            args.project_number = create_project(args.project_owner, args.create_project_title)
            project = get_project(args.project_owner, args.project_number)
            if project.get("public") is True:
                raise GitHubError("new GitHub Project is public; refusing task mutations")
            fields = []
        if args.repo.lower() not in {item.lower() for item in linked_repositories}:
            run_gh(
                [
                    "project",
                    "link",
                    str(args.project_number),
                    "--owner",
                    args.project_owner,
                    "--repo",
                    args.repo,
                ]
            )
        # Re-read the remote project after create/link. Do not let a stale preview or concurrent
        # configuration change project canonical tasks into a public or multi-repository board.
        project = get_project(args.project_owner, args.project_number)
        linked_repositories = list_linked_repositories(project)
        if project.get("public") is True:
            raise GitHubError("GitHub Project became public; refusing task mutations")
        if {item.lower() for item in linked_repositories} != {args.repo.lower()}:
            raise GitHubError(
                "GitHub Project must link exclusively to "
                f"{args.repo}; found {', '.join(linked_repositories) or 'no repository links'}"
            )
        fields = ensure_fields(args.project_owner, args.project_number, fields)
        apply_projection(
            repo=args.repo,
            owner=args.project_owner,
            number=args.project_number,
            projections=projections,
            issues=issues,
            fields=fields,
            project=project,
        )
        print(f"APPLIED: {len(projections)} task Issues projected to GitHub Project {args.project_owner}/{args.project_number} for {args.run_id}")
        return 0
    except (ValueError, GitHubError) as exc:
        print(f"REJECT: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
