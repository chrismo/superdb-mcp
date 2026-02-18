#!/usr/bin/env bats
# Live integration tests for research.sh
# Requires: gh (authenticated), super, bats
#
# Run: bats scripts/research.bats

SCRIPT="$BATS_TEST_DIRNAME/research.sh"

# --- help / arg handling ---------------------------------------------------

@test "no args shows help on stderr" {
  run "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "--help shows help on stderr" {
  run "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Commands:"* ]]
}

@test "unknown command exits 1" {
  run "$SCRIPT" badcommand
  [ "$status" -eq 1 ]
  [[ "$output" == *"Unknown command"* ]]
}

@test "search with no query exits 1" {
  run "$SCRIPT" search
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "commits with no query exits 1" {
  run "$SCRIPT" commits
  [ "$status" -eq 1 ]
}

@test "code with no query exits 1" {
  run "$SCRIPT" code
  [ "$status" -eq 1 ]
}

@test "issue with no number exits 1" {
  run "$SCRIPT" issue
  [ "$status" -eq 1 ]
}

@test "issue with non-numeric arg exits 1" {
  run "$SCRIPT" issue abc
  [ "$status" -eq 1 ]
}

@test "file with no path exits 1" {
  run "$SCRIPT" file
  [ "$status" -eq 1 ]
}

# --- live API tests --------------------------------------------------------

@test "search returns SUP records with expected fields" {
  output=$("$SCRIPT" search "count operator" 2>/dev/null)
  [ -n "$output" ]
  # Verify first record has expected fields
  first=$(echo "$output" | head -1)
  [[ "$first" == *"number:"* ]]
  [[ "$first" == *"kind:"* ]]
  [[ "$first" == *"state:"* ]]
  [[ "$first" == *"title:"* ]]
  [[ "$first" == *"url:"* ]]
}

@test "search kind field is PR or Issue" {
  output=$("$SCRIPT" search "count operator" 2>/dev/null | head -5)
  # Every line should have kind:"PR" or kind:"Issue"
  while IFS= read -r line; do
    [[ "$line" == *'kind:"PR"'* ]] || [[ "$line" == *'kind:"Issue"'* ]]
  done <<< "$output"
}

@test "commits returns records with sha, message, date, url" {
  output=$("$SCRIPT" commits "count operator" 2>/dev/null)
  [ -n "$output" ]
  first=$(echo "$output" | head -1)
  [[ "$first" == *"sha:"* ]]
  [[ "$first" == *"message:"* ]]
  [[ "$first" == *"date:"* ]]
  [[ "$first" == *"url:"* ]]
}

@test "commits sha is 10 characters" {
  output=$("$SCRIPT" commits "count operator" 2>/dev/null | head -1)
  sha=$(echo "$output" | super -f line -c "values sha" -)
  [ "${#sha}" -eq 10 ]
}

@test "code returns records with path and url" {
  output=$("$SCRIPT" code "expression context" 2>/dev/null)
  [ -n "$output" ]
  first=$(echo "$output" | head -1)
  [[ "$first" == *"path:"* ]]
  [[ "$first" == *"url:"* ]]
}

@test "issue returns issue details and comments" {
  # Issue 6344 is the "Count operator" PR - known to exist
  output=$("$SCRIPT" issue 6344 2>/dev/null)
  [ -n "$output" ]
  first=$(echo "$output" | head -1)
  [[ "$first" == *"number:6344"* ]]
  [[ "$first" == *"title:"* ]]
  [[ "$first" == *"state:"* ]]
  [[ "$first" == *"body:"* ]]
}

@test "issue includes comment records with user and date" {
  output=$("$SCRIPT" issue 6344 2>/dev/null)
  # Comments come after the first (issue detail) line
  comments=$(echo "$output" | tail -n +2)
  if [ -n "$comments" ]; then
    first_comment=$(echo "$comments" | head -1)
    [[ "$first_comment" == *"user:"* ]]
    [[ "$first_comment" == *"date:"* ]]
  else
    skip "No comments on this issue"
  fi
}

@test "file fetches raw file content" {
  output=$("$SCRIPT" file README.md 2>/dev/null)
  [ -n "$output" ]
  # README.md should mention SuperDB somewhere
  [[ "$output" == *"super"* ]] || [[ "$output" == *"Super"* ]]
}

@test "file with --ref fetches from a specific ref" {
  output=$("$SCRIPT" file README.md --ref v0.1.0 2>/dev/null)
  [ -n "$output" ]
  [[ "$output" == *"super"* ]] || [[ "$output" == *"Super"* ]]
}

@test "file on a directory returns listing" {
  output=$("$SCRIPT" file book/src/command 2>/dev/null)
  [ -n "$output" ]
  [[ "$output" == *"path:"* ]]
  [[ "$output" == *"type:"* ]]
}

@test "docs lists doc files" {
  output=$("$SCRIPT" docs 2>/dev/null)
  [ -n "$output" ]
  [[ "$output" == *"path:"* ]]
  # Should include known doc files
  [[ "$output" == *"SUMMARY.md"* ]]
}

@test "docs with path fetches a doc page" {
  output=$("$SCRIPT" docs SUMMARY 2>/dev/null)
  [ -n "$output" ]
  # SUMMARY.md is the mdbook table of contents
  [[ "$output" == *"Summary"* ]] || [[ "$output" == *"super"* ]]
}

@test "docs with --ref fetches from a tag" {
  output=$("$SCRIPT" docs SUMMARY --ref v0.1.0 2>/dev/null)
  [ -n "$output" ]
}

@test "search stderr shows progress" {
  stderr=$("$SCRIPT" search "count operator" 2>&1 >/dev/null)
  [[ "$stderr" == *"Searching issues/PRs"* ]]
  [[ "$stderr" == *"results"* ]]
}

@test "commits stderr shows progress" {
  stderr=$("$SCRIPT" commits "count operator" 2>&1 >/dev/null)
  [[ "$stderr" == *"Searching commits"* ]]
  [[ "$stderr" == *"results"* ]]
}
