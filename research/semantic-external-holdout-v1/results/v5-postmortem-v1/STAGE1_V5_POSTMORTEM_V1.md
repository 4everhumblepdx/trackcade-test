# Stage1 V5 post-mortem (offline, post-hoc diagnostic)

- V3 RAW ±2: 19 TP / 64 FP / 27 FN; F1 29.46%.
- V5 RAW ±2: 19 TP / 83 FP / 27 FN; F1 25.68%.
- Zero-reference proposals: V3 32 → V5 43.
- Positive-reference proposals: V3 51 → V5 59.

## Repetition relation at ±2

- `independent`: 49 proposals, 9 TP, 40 FP, precision 18.37%, zero-reference proposals 24.
- `repeated_similar`: 49 proposals, 10 TP, 39 FP, precision 20.41%, zero-reference proposals 19.
- `unclear`: 4 proposals, 0 TP, 4 FP, precision 0.00%, zero-reference proposals 0.

## Post-hoc diagnostic counterfactual

- Removing every `repeated_similar` proposal after the fact would yield 9 TP / 44 FP / 37 FN, F1 18.18%. This is diagnostic only and is not an authorized or predeclared gate.

## Track-level changes

- TP-gained positive tracks: [23].
- TP-lost positive tracks: [45].
- Zero-reference tracks with fewer FPs than V3: [].
- Zero-reference tracks with more FPs than V3: [1, 3, 15, 27, 36, 37, 44, 46].
