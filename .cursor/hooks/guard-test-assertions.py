#!/usr/bin/env python
"""Block edits that reduce active expect( calls in Playwright spec files.

preToolUse denies the tool call before the file changes.
afterFileEdit restores the previous text if a weakening edit already landed.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

TEST_FILE_RE = re.compile(
    r"(?:^|/)tests/.+\.(?:spec|test)\.(?:ts|tsx|js|jsx)$",
    re.IGNORECASE,
)
EXPECT_RE = re.compile(r"expect\s*\(")
EDIT_TOOLS = {"write", "strreplace", "edit", "search_replace"}


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def read_payload() -> dict:
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    if not raw.strip():
        eprint("guard-test-assertions: empty stdin")
        sys.exit(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        eprint(f"guard-test-assertions: invalid JSON — {exc}")
        sys.exit(1)


def normalize_path(file_path: str) -> str:
    return file_path.replace("\\", "/")


def is_test_file(file_path: str) -> bool:
    return bool(TEST_FILE_RE.search(normalize_path(file_path)))


def line_code_portion(line: str) -> str:
    stripped = line.lstrip()
    if stripped.startswith("//") or stripped.startswith("*"):
        return ""
    if "//" in line:
        return line.split("//", 1)[0]
    return line


def count_active_expects(text: str) -> int:
    total = 0
    for line in text.splitlines():
        portion = line_code_portion(line)
        total += len(EXPECT_RE.findall(portion))
    return total


def first_string(source: dict, keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def tool_input_of(payload: dict) -> dict:
    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        return tool_input
    return payload


def resolve_path(payload: dict) -> str | None:
    sources = [payload, tool_input_of(payload)]
    for source in sources:
        found = first_string(source, ("file_path", "path", "file"))
        if found:
            return found
    return None


def get_edits(payload: dict) -> list[dict]:
    for source in (payload, tool_input_of(payload)):
        edits = source.get("edits")
        if isinstance(edits, list):
            return [edit for edit in edits if isinstance(edit, dict)]
        old = source.get("old_string")
        new = source.get("new_string")
        if isinstance(old, str) or isinstance(new, str):
            return [source]
    return []


def apply_edit(content: str, edit: dict) -> str | None:
    old = edit.get("old_string")
    new = edit.get("new_string")
    if not isinstance(old, str) or not isinstance(new, str):
        return None
    if old not in content:
        return None
    if edit.get("replace_all"):
        return content.replace(old, new)
    return content.replace(old, new, 1)


def reconstruct_before(after: str, edits: list[dict]) -> tuple[str, bool]:
    content = after
    for edit in reversed(edits):
        old = edit.get("old_string")
        new = edit.get("new_string")
        if not isinstance(old, str) or not isinstance(new, str):
            return after, False
        if edit.get("replace_all"):
            if new and new not in content:
                return after, False
            content = content.replace(new, old)
        else:
            if new not in content:
                return after, False
            content = content.replace(new, old, 1)
    return content, True


def read_disk(file_path: str) -> str | None:
    path = Path(file_path)
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8")


def projected_contents(payload: dict, before: str | None) -> str | None:
    source = tool_input_of(payload)
    contents = source.get("contents")
    if not isinstance(contents, str):
        contents = source.get("content")
    if isinstance(contents, str):
        return contents

    edits = get_edits(payload)
    if not edits or before is None:
        return None
    projected = before
    for edit in edits:
        next_text = apply_edit(projected, edit)
        if next_text is None:
            return None
        projected = next_text
    return projected


def message(file_path: str, before: int, after: int) -> str:
    return (
        f"Blocked: test assertions weakened in {file_path} — "
        f"active expect( count {before} -> {after}. "
        "Do not delete or comment out assertions to make tests pass. "
        "Fix the app, locator, or test data instead."
    )


def deny(file_path: str, before: int, after: int) -> None:
    msg = message(file_path, before, after)
    print(
        json.dumps(
            {
                "permission": "deny",
                "user_message": msg,
                "agent_message": msg,
            }
        )
    )
    eprint(msg)
    sys.exit(2)


def allow(note: str) -> None:
    eprint(note)
    print(json.dumps({"permission": "allow"}))
    sys.exit(0)


def is_edit_tool(payload: dict) -> bool:
    name = payload.get("tool_name") or payload.get("tool") or ""
    if not isinstance(name, str) or not name.strip():
        return True
    return name.strip().lower() in EDIT_TOOLS


def handle_pre_tool_use(payload: dict) -> None:
    if not is_edit_tool(payload):
        allow("guard-test-assertions: skip non-edit tool")

    file_path = resolve_path(payload)
    if not file_path or not is_test_file(file_path):
        allow(f"guard-test-assertions: skip {file_path or '(none)'}")

    before_text = read_disk(file_path)
    after_text = projected_contents(payload, before_text)
    if after_text is None or before_text is None:
        allow(f"guard-test-assertions: no comparable text for {file_path}")

    before_count = count_active_expects(before_text)
    after_count = count_active_expects(after_text)
    if after_count < before_count:
        deny(normalize_path(file_path), before_count, after_count)

    allow(
        f"guard-test-assertions: OK — {after_count} active expect( preserved"
    )


def handle_after_file_edit(payload: dict) -> None:
    file_path = resolve_path(payload)
    if not file_path or not is_test_file(file_path):
        allow(f"guard-test-assertions: skip {file_path or '(none)'}")

    path = Path(file_path)
    after_text = read_disk(file_path) or ""
    edits = get_edits(payload)
    before_text, ok = reconstruct_before(after_text, edits)
    if not ok:
        allow(f"guard-test-assertions: could not rebuild previous text for {file_path}")

    before_count = count_active_expects(before_text)
    after_count = count_active_expects(after_text)
    if before_count > after_count:
        path.write_text(before_text, encoding="utf-8", newline="")
        deny(normalize_path(file_path), before_count, after_count)

    allow(
        f"guard-test-assertions: OK — {after_count} active expect( preserved"
    )


def main() -> None:
    payload = read_payload()
    event = payload.get("hook_event_name")
    if event == "preToolUse" or payload.get("tool_name") or payload.get("tool_input"):
        handle_pre_tool_use(payload)
    handle_after_file_edit(payload)


if __name__ == "__main__":
    main()
