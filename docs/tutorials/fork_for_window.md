---
name: fork-for-window
description: "Using fork as a workaround for window functions to do per-group selection."
superdb_version: "0.1.0"
last_updated: "2026-02-17"
source: "https://github.com/chrismo/superkit/blob/main/doc/fork_for_window.md"
---

# Fork as a Window Function Workaround

Window functions like `ROW_NUMBER() OVER (PARTITION BY ...)` are not yet
available in SuperDB ([brimdata/super#5921][issue]). This tutorial shows how to
use `fork` to achieve per-group selection — picking the top N items from each
group.

[issue]: https://github.com/brimdata/super/issues/5921

## The Problem

You have a pool of available EC2 instances spread across availability zones.
You need to pick instances while maximizing AZ distribution — taking an equal
number from each zone rather than filling up from one.

Sample data:

```
{id:'i-001', az:'us-east-1a'}
{id:'i-002', az:'us-east-1a'}
{id:'i-003', az:'us-east-1a'}
{id:'i-004', az:'us-east-1b'}
{id:'i-005', az:'us-east-1c'}
{id:'i-006', az:'us-east-1c'}
{id:'i-007', az:'us-east-1c'}
{id:'i-008', az:'us-east-1c'}
```

Distribution: 3 in `us-east-1a`, 1 in `us-east-1b`, 4 in `us-east-1c`.

## What You'd Want (Window Functions)

In SQL with window functions, this would be straightforward:

```sql
SELECT * FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY az ORDER BY id) as rn
  FROM instances
) WHERE rn <= 2
```

This assigns a row number within each AZ group, then filters to keep only the
first 2 per group. But SuperDB doesn't support this yet.

## The Fork Approach

`fork` splits the input stream into parallel branches. Each branch receives a
copy of **all** the input records, processes them independently, and the results
from every branch are merged back together into a single stream.

Here's the full query — we'll break it down step by step after:

```
from instances.sup
| fork
  ( where az=='us-east-1a' | head 2 )
  ( where az=='us-east-1b' | head 2 )
  ( where az=='us-east-1c' | head 2 )
| sort az, id
```

### Step by Step

**Step 1: `from instances.sup`** — reads all 8 records into the stream:

```
id    az
i-001 us-east-1a
i-002 us-east-1a
i-003 us-east-1a
i-004 us-east-1b
i-005 us-east-1c
i-006 us-east-1c
i-007 us-east-1c
i-008 us-east-1c
```

**Step 2: `fork`** — sends all 8 records into each of three branches. Each
branch sees the full input and processes it independently.

**Branch 1:** `where az=='us-east-1a'` filters to 3 records, then `head 2`
keeps the first 2:

```
id    az
i-001 us-east-1a
i-002 us-east-1a
```

(i-003 was filtered out by `head 2`)

**Branch 2:** `where az=='us-east-1b'` filters to 1 record, `head 2` returns
what's available:

```
id    az
i-004 us-east-1b
```

Only 1 instance exists in this AZ. `head 2` doesn't error or pad — it just
returns what's there.

**Branch 3:** `where az=='us-east-1c'` filters to 4 records, `head 2` keeps
the first 2:

```
id    az
i-005 us-east-1c
i-006 us-east-1c
```

(i-007 and i-008 were filtered out by `head 2`)

**Step 3: implicit combine** — after the fork closes, results from all three
branches merge back into a single stream of 5 records. Fork branches run in
parallel and finish in nondeterministic order, so the combined output may be
interleaved differently on each run. This is why the final `sort` matters.

**Step 4: `sort az, id`** — sorts the combined results for clean, predictable
output:

```
id    az
i-001 us-east-1a
i-002 us-east-1a
i-004 us-east-1b
i-005 us-east-1c
i-006 us-east-1c
```

2 from `us-east-1a`, 1 from `us-east-1b` (all it had), 2 from `us-east-1c` —
as balanced as possible given the available pool.

## Why Not Just Sort and Head?

Without fork, you might try:

```
from instances.sup | sort az, id | head 5
```

```
id    az
i-001 us-east-1a
i-002 us-east-1a
i-003 us-east-1a
i-004 us-east-1b
i-005 us-east-1c
```

All 3 from `us-east-1a`, the 1 from `us-east-1b`, and only 1 from `us-east-1c`.
That's unbalanced — it fills up from the first AZ alphabetically instead of
distributing evenly.

## Verifying the Distribution

You can check the balance of your selection by piping through an aggregate:

```
from instances.sup
| fork
  ( where az=='us-east-1a' | head 2 )
  ( where az=='us-east-1b' | head 2 )
  ( where az=='us-east-1c' | head 2 )
| aggregate count:=count() by az
| sort az
```

```
az         count
us-east-1a 2
us-east-1b 1
us-east-1c 2
```

## Trade-offs

**The fork branches are static.** You need to know the group values (AZ names)
ahead of time and write one branch per group. This is fine when:

- The groups are known and stable (like AZs in a region)
- The number of groups is small

It's less ideal when groups are dynamic or numerous. In those cases, you'd need
to first query for distinct group values, then build the fork dynamically — or
wait for window function support.

**With window functions**, the query would handle any number of groups
automatically and support more sophisticated ranking (e.g., ordering within
groups by launch time, instance type preference, etc.).

## Full Example

Save the sample data:

```bash
cat > /tmp/instances.sup << 'EOF'
{id:'i-001', az:'us-east-1a'}
{id:'i-002', az:'us-east-1a'}
{id:'i-003', az:'us-east-1a'}
{id:'i-004', az:'us-east-1b'}
{id:'i-005', az:'us-east-1c'}
{id:'i-006', az:'us-east-1c'}
{id:'i-007', az:'us-east-1c'}
{id:'i-008', az:'us-east-1c'}
EOF
```

Pick 2 per AZ:

```bash
super -f table -c "
  from '/tmp/instances.sup'
  | fork
    ( where az=='us-east-1a' | head 2 )
    ( where az=='us-east-1b' | head 2 )
    ( where az=='us-east-1c' | head 2 )
  | sort az, id
"
```
