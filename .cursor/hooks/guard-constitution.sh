#!/usr/bin/env bash
set -euo pipefail
exec python "$(dirname "$0")/guard-constitution.py"
