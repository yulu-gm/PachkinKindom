# Remove Top Two Peg Rows Design

**Date:** 2026-09-01

## Goal

Create a clear, peg-free entry space at the top of the pachinko field by removing the existing first two peg rows.

## Final Geometry

- Change the fixed peg grid from 8 columns × 7 rows to 8 columns × 5 rows.
- Keep the existing horizontal positions: `x = 60, 128, 196, 264, 332, 400, 468, 536`.
- Keep the lower five existing vertical positions: `y = 250, 305, 360, 415, 470`.
- Reindex the remaining 40 slots from 0 through 39 in row-major order.
- Do not move the launcher, guide rail, bottom exit, transfer lane, or tactics board.

## Behavior

- The upper field from the entrance to `y=250` contains no pegs.
- Normal and special peg collision effects remain unchanged.
- Shop peg dragging continues to target any of the 40 legal slots.
- Removing two rows intentionally lowers the average number of peg hits and experience gained per launch.

## Verification

- Rule tests assert exactly 40 slots, 8 unique X positions, and 5 unique Y positions.
- Geometry tests assert a minimum peg Y of 250 and maximum peg Y of 470.
- The complete test suite and production build must pass.
