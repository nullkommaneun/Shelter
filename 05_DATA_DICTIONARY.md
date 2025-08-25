# Data Dictionary

## Buildings (Konfig)
- key: Name (string)
- color: Hex-Farbe
- cost: { wood?, metal?, food? } (int ≥0)
- out:  { wood?, metal?, food? } (int ≥0 / sec * level)
- power: { prod?, need? } (int ≥0)
- defense: int ≥0 (pro Level)
- up: float ≥1 (Kosten-Multiplikator je Level)
- max: int ≥1 (Max-Level)

## Game State (Save)
{
  grid: (ROWS x COLS) of { type: string, level: int } | null,
  res:  { wood:int, metal:int, food:int },
  t: int (Sekunden),
  threat: 0..100,
  hp: 0..100,
  selected: string,
  mode: "build"|"demolish",
  seed: uint32,
  ver: int (Save-Schema-Version)
}

### Export/Import
- Text: `SV|<ver>|<timestamp>|<BASE64(JSON)>`

## Preflight (PF)
- Text: `PF|pf-v1.0|<timestamp>|<BASE64(JSON)>`
