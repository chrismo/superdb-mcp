#!/usr/bin/env bash

# Run mdtest against tutorial markdown files.
#
# Requires a local checkout of brimdata/super at ../super (sibling directory).
# The kit_test.go file in super/mdtest/ provides the test harness.
#
# Usage:
#   ./test-doc.sh                  # run all tutorials
#   ./test-doc.sh grok             # filter by pattern
#   ./test-doc.sh -d tutorials     # test tutorials (default)
#   ./test-doc.sh -d .             # test all docs (tutorials + guides)

set -euo pipefail

SUPER_DIR="${SUPER_DIR:-../super}"
DOCS_SUBDIR="tutorials"

while getopts "d:" opt; do
  case $opt in
    d) DOCS_SUBDIR="$OPTARG" ;;
    *) ;;
  esac
done
shift $((OPTIND - 1))

filter="${1:-}"

if [ ! -d "$SUPER_DIR/mdtest" ]; then
  echo "Error: brimdata/super not found at $SUPER_DIR"
  echo "Set SUPER_DIR to the path of your local super checkout."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$DOCS_SUBDIR" = "." ]; then
  mdpath="$SCRIPT_DIR/docs"
else
  mdpath="$SCRIPT_DIR/docs/$DOCS_SUBDIR"
fi

cd "$SUPER_DIR"
go test -v -tags=kit ./mdtest -mdpath="$mdpath" -mdfilter="$filter"
