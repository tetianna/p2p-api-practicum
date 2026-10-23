#!/usr/bin/env python
"""afterFileEdit hook: block new constitution WON'T violations in tests/ and pages/."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

GUARDED_RE = re.compile(
    r"(?:^|/)(?:tests|pages)/.+\.(?:ts|tsx|js|jsx)$",
    re.IGNORECASE,
)
SPEC_FILE_RE = re.compile(
    r"tests/.+\.(?:spec|test)\.(?:ts|tsx|js|jsx)$",
    re.IGNORECASE,
)
EXPECT_RE = re.compile(r"expect\s*\(")

WAIT_FOR_TIMEOUT_RE = re.compile(r"\.waitForTimeout\s*\(")
XPATH_LOCATOR_RE = re.compile(
    r"locator\s*\(\s*(['\"])//",
    re.IGNORECASE,
)
ANY_TYPE_RES = (
    re.compile(r":\s*any\b"),
    re.compile(r"\bas\s+any\b"),
    re.compile(r"<\s*any\s*>"),
    re.compile(r"Array\s*<\s*any\s*>"),
)
FILL_EMAIL_RE = re.compile(
    r"\.fill\s*\(\s*(['\"])[^'\"]*@[^'\"]*\1",
    re.IGNORECASE,
)
CREDENTIAL_ASSIGN_RE = re.compile(
    r"(password|secret|api_key|token)\s*[=:]\s*['\"][^'\"]{4,}['\"]",
    re.IGNORECASE,
)
DESCRIBE_TAG_RE = re.compile(
    r"test\.describe\s*\([^)]*,\s*\{[^}]*\btag\s*:",
    re.IGNORECASE | re.DOTALL,
)


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def read_payload() -> dict:
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    if not raw.strip():
        eprint("guard-constitution: empty stdin")
        sys.exit(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        eprint(f"guard-constitution: invalid JSON — {exc}")
        sys.exit(1)


def normalize_path(file_path: str) -> str:
    return file_path.replace("\\", "/")


def is_guarded_file(file_path: str) -> bool:
    return bool(GUARDED_RE.search(normalize_path(file_path)))


def is_spec_file(file_path: str) -> bool:
    return bool(SPEC_FILE_RE.search(normalize_path(file_path)))


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


def resolve_path(payload: dict) -> str | None:
    for key in ("file_path", "path", "file"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def get_edits(payload: dict) -> list[dict]:
    edits = payload.get("edits")
    if isinstance(edits, list):
        return [e for e in edits if isinstance(e, dict)]
    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        inner = tool_input.get("edits")
        if isinstance(inner, list):
            return [e for e in inner if isinstance(e, dict)]
        if tool_input.get("old_string") is not None or tool_input.get("new_string") is not None:
            return [tool_input]
    return []


def read_after_content(path: Path, payload: dict) -> str:
    if path.is_file():
        return path.read_text(encoding="utf-8")
    for key in ("content", "contents", "new_content", "newContent"):
        value = payload.get(key)
        if isinstance(value, str):
            return value
    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        for key in ("content", "contents"):
            value = tool_input.get(key)
            if isinstance(value, str):
                return value
    return ""


def reconstruct_before(after: str, edits: list[dict]) -> tuple[str, bool]:
    content = after
    for edit in reversed(edits):
        old = edit.get("old_string")
        new = edit.get("new_string")
        if not isinstance(old, str) or not isinstance(new, str):
            return after, False
        replace_all = bool(edit.get("replace_all"))
        if replace_all:
            if new and new not in content:
                return after, False
            content = content.replace(new, old)
        else:
            if new not in content:
                return after, False
            content = content.replace(new, old, 1)
    return content, True


def pattern_present(text: str, pattern: re.Pattern[str]) -> bool:
    return bool(pattern.search(text))


def any_type_present(text: str) -> bool:
    return any(p.search(text) for p in ANY_TYPE_RES)


def find_new_violations(before: str, after: str) -> list[str]:
    reasons: list[str] = []

    if pattern_present(after, WAIT_FOR_TIMEOUT_RE) and not pattern_present(
        before, WAIT_FOR_TIMEOUT_RE
    ):
        reasons.append("introduced .waitForTimeout(")

    if pattern_present(after, XPATH_LOCATOR_RE) and not pattern_present(before, XPATH_LOCATOR_RE):
        reasons.append("introduced XPath locator (locator('//…'))")

    if any_type_present(after) and not any_type_present(before):
        reasons.append('introduced TypeScript any (": any", "as any", "<any>", or "Array<any>")')

    if pattern_present(after, FILL_EMAIL_RE) and not pattern_present(before, FILL_EMAIL_RE):
        reasons.append("introduced hardcoded email in .fill('…@…')")

    if pattern_present(after, CREDENTIAL_ASSIGN_RE) and not pattern_present(
        before, CREDENTIAL_ASSIGN_RE
    ):
        reasons.append(
            "introduced hardcoded credential (password/secret/api_key/token literal, 4+ chars)"
        )

    if pattern_present(after, DESCRIBE_TAG_RE) and not pattern_present(before, DESCRIBE_TAG_RE):
        reasons.append("introduced tag on test.describe(..., { tag: … })")

    return reasons


def violations_in_delta(old: str, new: str) -> list[str]:
    return find_new_violations(old, new)


def block(file_path: str, reason: str) -> None:
    msg = f"Blocked: constitution violation in {file_path} — {reason}"
    out = {"user_message": msg, "agent_message": msg}
    print(json.dumps(out))
    eprint(msg)
    sys.exit(2)


def ok(file_path: str) -> None:
    eprint(f"guard-constitution: OK — {file_path}")
    sys.exit(0)


def main() -> None:
    payload = read_payload()
    file_path = resolve_path(payload)
    if not file_path or not is_guarded_file(file_path):
        ok(file_path or "(none)")
        return

    path = Path(file_path)
    after_text = read_after_content(path, payload)
    edits = get_edits(payload)
    before_text, reconstructed = reconstruct_before(after_text, edits)

    reasons = find_new_violations(before_text, after_text)

    if not reconstructed and edits:
        for edit in edits:
            old = edit.get("old_string")
            new = edit.get("new_string")
            if isinstance(old, str) and isinstance(new, str):
                for reason in violations_in_delta(old, new):
                    if reason not in reasons:
                        reasons.append(reason)

    if is_spec_file(file_path):
        before_count = count_active_expects(before_text)
        after_count = count_active_expects(after_text)
        if after_count < before_count:
            reasons.append(
                f"weakened assertions (active expect( count {before_count} -> {after_count})"
            )

    if reasons:
        block(normalize_path(file_path), "; ".join(reasons))

    ok(normalize_path(file_path))


if __name__ == "__main__":
    main()
