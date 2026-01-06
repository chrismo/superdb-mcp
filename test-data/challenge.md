# Chess Tournament Analysis Challenge

## The Data

You have a PGN (Portable Game Notation) file at `test-data/tournament.pgn` containing games from a chess tournament. The tournament has:
- A main event (Rounds 1-3) - round-robin format
- Tiebreak games (Rounds TB1, TB2) - playoff games between tied players

PGN format has metadata in brackets like `[White "LastName, FirstName"]` and `[Result "1-0"]` followed by move notation. Results are:
- `1-0` = White wins
- `0-1` = Black wins
- `1/2-1/2` = Draw

## The Challenge

**Find all "revenge games"** — instances where:
1. Player A lost to Player B in the main tournament (Rounds 1-3)
2. Player A then beat Player B in the tiebreaks (Rounds starting with "TB")

For each revenge, show:
- The avenger (player who got revenge)
- The original victor (player who won first, lost later)
- The round where the original loss occurred
- The tiebreak round(s) where revenge was achieved

## Requirements

- Use SuperDB (`super` command) to parse and analyze the PGN file
- The solution should work directly on the PGN file (no manual preprocessing)
- Show your reasoning and intermediate steps

## Hints

- SuperDB's `-i line` flag treats each line as a separate string record
- The `grok` function can parse structured text with patterns
- You may need to pair up White/Black/Result lines that belong to the same game
- Consider how to normalize player names (they appear as "LastName, FirstName")
- Think about how to determine the winner from the Result + color combination

## Expected Output Format

```
{avenger: "...", victim: "...", original_loss_round: "...", revenge_rounds: [...]}
```

Good luck!
