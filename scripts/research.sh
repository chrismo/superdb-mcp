#!/bin/bash
# research.sh - Read-only research tool for the brimdata/super GitHub repo
#
# Searches issues, PRs, commits, code, and docs. All operations are read-only
# GET requests scoped to brimdata/super, safe for whitelisting.
#
# Requirements: gh (authenticated), super (v0.1.0+)
#
# Usage:
#   ./scripts/research.sh <command> [args...]
#
# Commands:
#   search <query>            Search issues and PRs
#   commits <query>           Search commits
#   code <query>              Search code in the repo
#   issue <number>            Fetch issue/PR details + comments
#   file <path> [--ref REF]   Fetch a file from the repo (default ref: main)
#   docs [--ref REF]          List doc pages (from book/src/ in the repo)
#   docs <path> [--ref REF]   Fetch a doc page (e.g. "super-sql/operators/count")

set -euo pipefail

REPO="brimdata/super"

# --- helpers ---------------------------------------------------------------

urlencode_query() {
  printf '%s' "$1" | sed 's/ /+/g; s/"/%22/g'
}

api_get() {
  gh api "$1"
}

# --- subcommands -----------------------------------------------------------

cmd_search() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: $0 search <query>" >&2
    echo "  Search issues and PRs in $REPO" >&2
    exit 1
  fi
  local query
  query=$(urlencode_query "$*")
  echo "--- Searching issues/PRs: $* ---" >&2
  local json
  json=$(api_get "search/issues?q=repo:${REPO}+${query}&per_page=30") || { echo "  (API error)" >&2; return 1; }
  local total
  total=$(echo "$json" | super -f line -c "values total_count" -)
  echo "  $total results" >&2
  echo "$json" \
    | super -s -c "
        unnest items
        | values {
            number,
            kind: has(pull_request) ? 'PR' : 'Issue',
            state,
            title,
            url: html_url,
            created: created_at
          }
      " -
}

cmd_commits() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: $0 commits <query>" >&2
    echo "  Search commits in $REPO" >&2
    exit 1
  fi
  local query
  query=$(urlencode_query "$*")
  echo "--- Searching commits: $* ---" >&2
  local json
  json=$(api_get "search/commits?q=repo:${REPO}+${query}&per_page=15") || { echo "  (API error)" >&2; return 1; }
  local total
  total=$(echo "$json" | super -f line -c "values total_count" -)
  echo "  $total results" >&2
  echo "$json" \
    | super -s -c "
        unnest items
        | values {
            sha: sha[0:10],
            message: split(commit.message, '\n')[0],
            date: commit.author.date[0:10],
            url: html_url
          }
      " -
}

cmd_code() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: $0 code <query>" >&2
    echo "  Search code in $REPO" >&2
    exit 1
  fi
  local query
  query=$(urlencode_query "$*")
  echo "--- Searching code: $* ---" >&2
  local json
  json=$(api_get "search/code?q=repo:${REPO}+${query}&per_page=30") || { echo "  (API error)" >&2; return 1; }
  local total
  total=$(echo "$json" | super -f line -c "values total_count" -)
  echo "  $total results" >&2
  echo "$json" \
    | super -s -c "
        unnest items
        | values {
            path,
            url: html_url
          }
      " -
}

cmd_issue() {
  if [[ $# -eq 0 || ! "$1" =~ ^[0-9]+$ ]]; then
    echo "Usage: $0 issue <number>" >&2
    echo "  Fetch issue/PR details and comments from $REPO" >&2
    exit 1
  fi
  local num="$1"

  echo "--- Fetching issue/PR #$num ---" >&2
  local json
  json=$(api_get "repos/${REPO}/issues/$num") || { echo "  (API error)" >&2; return 1; }
  echo "$json" \
    | super -s -c "
        values {
          number,
          title,
          state,
          url: html_url,
          created: created_at,
          body: body is not null ? (len(body) > 3000 ? f'{body[0:3000]}...' : body) : '<no body>'
        }
      " -

  echo "--- Fetching comments for #$num ---" >&2
  local comments
  comments=$(api_get "repos/${REPO}/issues/$num/comments?per_page=30") || { echo "  (API error fetching comments)" >&2; return 1; }
  echo "$comments" \
    | super -s -c "
        unnest this
        | values {
            user: user.login,
            date: created_at[0:10],
            body: len(body) > 800 ? f'{body[0:800]}...' : body
          }
      " -
}

cmd_file() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: $0 file <path> [--ref REF]" >&2
    echo "  Fetch a file from $REPO (default ref: main)" >&2
    exit 1
  fi
  local path="$1"; shift
  local ref="main"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ref) ref="$2"; shift 2 ;;
      *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
  done

  echo "--- Fetching file: $path (ref: $ref) ---" >&2
  local json
  json=$(api_get "repos/${REPO}/contents/${path}?ref=${ref}") || { echo "  (not found or API error)" >&2; return 1; }

  # GitHub returns a JSON array for directories, an object for files
  if [[ "$json" == "["* ]]; then
    echo "(path is a directory)" >&2
    echo "$json" \
      | super -s -c "
          unnest this
          | values {
              name,
              type,
              path
            }
        " -
    return
  fi

  # Decode base64 content
  echo "$json" | super -f line -c "values base64(replace(content, '\n', ''))::string" -
}

cmd_docs() {
  local ref="main"
  local doc_path=""
  local docs_prefix="book/src"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ref) ref="$2"; shift 2 ;;
      *) doc_path="$1"; shift ;;
    esac
  done

  if [[ -z "$doc_path" ]]; then
    # List doc tree
    echo "--- Listing docs (ref: $ref) ---" >&2
    local json
    json=$(api_get "repos/${REPO}/git/trees/${ref}?recursive=1") || { echo "  (API error)" >&2; return 1; }
    local prefix_len=${#docs_prefix}
    local slash_len=$(( prefix_len + 1 ))
    echo "$json" \
      | super -s -c "
          unnest tree
          | where path[0:${slash_len}] == '${docs_prefix}/' and type == 'blob'
          | values {path: path[${slash_len}:]}
        " -
  else
    # Fetch a specific doc page
    # Normalize: strip leading prefix, add .md if needed
    doc_path="${doc_path#${docs_prefix}/}"
    doc_path="${doc_path#book/src/}"
    if [[ "$doc_path" != *.md ]]; then
      doc_path="${doc_path}.md"
    fi
    local full_path="${docs_prefix}/${doc_path}"

    echo "--- Fetching doc: $full_path (ref: $ref) ---" >&2
    local json
    json=$(api_get "repos/${REPO}/contents/${full_path}?ref=${ref}") || { echo "  (API error - doc may not exist at this ref)" >&2; return 1; }
    echo "$json" | super -f line -c "values base64(replace(content, '\n', ''))::string" -
  fi
}

# --- main ------------------------------------------------------------------

if [[ $# -eq 0 || "$1" == "--help" || "$1" == "-h" ]]; then
  cat >&2 <<'EOF'
Usage: ./scripts/research.sh <command> [args...]

Read-only research tool for the brimdata/super GitHub repo.

Commands:
  search <query>            Search issues and PRs
  commits <query>           Search commits
  code <query>              Search code in the repo
  issue <number>            Fetch issue/PR details + comments
  file <path> [--ref REF]   Fetch a file from the repo (default ref: main)
  docs [--ref REF]          List doc pages (from book/src/ in the repo)
  docs <path> [--ref REF]   Fetch a doc page (e.g. "super-sql/operators/count")

Options:
  --ref <ref>    Git ref: branch, tag, or commit SHA (default: main)
                 Works with file and docs commands.

Examples:
  ./scripts/research.sh search "count operator"
  ./scripts/research.sh commits "drop agg"
  ./scripts/research.sh code "expression context"
  ./scripts/research.sh issue 6355
  ./scripts/research.sh file README.md
  ./scripts/research.sh file book/src/SUMMARY.md --ref v0.1.0
  ./scripts/research.sh docs
  ./scripts/research.sh docs super-sql/operators/count
  ./scripts/research.sh docs super-sql/operators/count --ref v0.1.0
EOF
  exit 0
fi

command="$1"; shift

case "$command" in
  search)  cmd_search "$@" ;;
  commits) cmd_commits "$@" ;;
  code)    cmd_code "$@" ;;
  issue)   cmd_issue "$@" ;;
  file)    cmd_file "$@" ;;
  docs)    cmd_docs "$@" ;;
  *)
    echo "Unknown command: $command" >&2
    echo "Run '$0 --help' for usage." >&2
    exit 1
    ;;
esac
