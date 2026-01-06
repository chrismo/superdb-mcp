# Expected Answer

## Tournament Summary

### Main Tournament (Rounds 1-3)
| Round | White | Black | Result | Winner |
|-------|-------|-------|--------|--------|
| 1 | Giri | Gukesh | 1-0 | Giri |
| 1 | Wei | Abdusattorov | 1/2-1/2 | Draw |
| 2 | Gukesh | Wei | 0-1 | Wei |
| 2 | Abdusattorov | Giri | 1-0 | Abdusattorov |
| 3 | Giri | Wei | 1/2-1/2 | Draw |
| 3 | Gukesh | Abdusattorov | 1-0 | Gukesh |

### Tiebreaks
| Round | White | Black | Result | Winner |
|-------|-------|-------|--------|--------|
| TB1 | Gukesh | Giri | 1-0 | Gukesh |
| TB1 | Wei | Abdusattorov | 0-1 | Abdusattorov |
| TB2 | Giri | Gukesh | 0-1 | Gukesh |
| TB2 | Abdusattorov | Wei | 1-0 | Abdusattorov |

## Revenge Analysis

### Who lost to whom in main tournament?
- Gukesh lost to: Giri (R1), Wei (R2)
- Giri lost to: Abdusattorov (R2)
- Wei lost to: nobody (drew twice, won once)
- Abdusattorov lost to: Gukesh (R3)

### Tiebreak matchups:
- Gukesh vs Giri: Gukesh won both (TB1, TB2)
- Abdusattorov vs Wei: Abdusattorov won both (TB1, TB2)

### Revenge games found:

**1. Gukesh got revenge on Giri**
- Original loss: Round 1 (Giri beat Gukesh)
- Revenge: TB1 and TB2 (Gukesh beat Giri both times)

### Not revenge:
- Abdusattorov beat Wei in tiebreaks, but only drew Wei in main tournament (not a loss)
- Giri lost to Abdusattorov in main but didn't play Abdusattorov in tiebreaks
- Gukesh lost to Wei in main but didn't play Wei in tiebreaks
- Abdusattorov lost to Gukesh in main but didn't play Gukesh in tiebreaks

## Expected Output

```json
{avenger: "Gukesh", victim: "Giri", original_loss_round: "1", revenge_rounds: ["TB1", "TB2"]}
```

Or if showing individual revenge instances:
```json
{avenger: "Gukesh", victim: "Giri", lost_in: "1", revenge_in: "TB1"}
{avenger: "Gukesh", victim: "Giri", lost_in: "1", revenge_in: "TB2"}
```
