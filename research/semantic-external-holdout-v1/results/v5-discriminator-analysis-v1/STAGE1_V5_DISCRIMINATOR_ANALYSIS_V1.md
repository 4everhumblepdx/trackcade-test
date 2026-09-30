# Stage1 V5 discriminator analysis (offline, post-hoc development diagnostic)

- Frozen V5 proposals: 102; 19 TP / 83 FP at ±2.
- Confidence rank AUC for TP vs FP: 0.722 (0.5 = no separation).

## V3/V5 agreement

- `allV5`: 19 TP / 83 FP / 27 FN; precision 18.63%, F1 25.68%; zero-reference proposals 43.
- `v3AgreementWithin2s`: 18 TP / 60 FP / 28 FN; precision 23.08%, F1 29.03%; zero-reference proposals 31.
- `v5OnlyBeyond2sFromV3`: 1 TP / 23 FP / 45 FN; precision 4.17%, F1 2.86%; zero-reference proposals 12.

## Confidence counterfactuals (diagnostic only)

- `>=0.70`: 19 TP / 83 FP / 27 FN; precision 18.63%, recall 41.30%, F1 25.68%.
- `>=0.75`: 19 TP / 75 FP / 27 FN; precision 20.21%, recall 41.30%, F1 27.14%.
- `>=0.80`: 17 TP / 51 FP / 29 FN; precision 25.00%, recall 36.96%, F1 29.82%.
- `>=0.82`: 16 TP / 47 FP / 30 FN; precision 25.40%, recall 34.78%, F1 29.36%.
- `>=0.84`: 15 TP / 35 FP / 31 FN; precision 30.00%, recall 32.61%, F1 31.25%.
- `>=0.86`: 14 TP / 26 FP / 32 FN; precision 35.00%, recall 30.43%, F1 32.56%.
- `>=0.88`: 7 TP / 18 FP / 39 FN; precision 28.00%, recall 15.22%, F1 19.72%.
- `>=0.90`: 4 TP / 10 FP / 42 FN; precision 28.57%, recall 8.70%, F1 13.33%.
- `>=0.92`: 1 TP / 4 FP / 45 FN; precision 20.00%, recall 2.17%, F1 3.92%.
- `>=0.94`: 0 TP / 1 FP / 46 FN; precision 0.00%, recall 0.00%, F1 0.00%.

## Proposal-count strata

- track emits `1` Drop proposal(s): 11 proposals, 3 TP / 8 FP, precision 27.27%, zero-reference proposals 8.
- track emits `2` Drop proposal(s): 36 proposals, 8 TP / 28 FP, precision 22.22%, zero-reference proposals 14.
- track emits `3` Drop proposal(s): 15 proposals, 0 TP / 15 FP, precision 0.00%, zero-reference proposals 6.
- track emits `4plus` Drop proposal(s): 40 proposals, 8 TP / 32 FP, precision 20.00%, zero-reference proposals 15.

## Rationale terms

- `energy`: 96 proposals, 17 TP / 79 FP, precision 17.71%, zero-reference FP 40.
- `sustained`: 94 proposals, 18 TP / 76 FP, precision 19.15%, zero-reference FP 41.
- `stronger`: 71 proposals, 13 TP / 58 FP, precision 18.31%, zero-reference FP 29.
- `release`: 66 proposals, 11 TP / 55 FP, precision 16.67%, zero-reference FP 29.
- `return`: 29 proposals, 5 TP / 24 FP, precision 17.24%, zero-reference FP 11.
- `quiet`: 23 proposals, 6 TP / 17 FP, precision 26.09%, zero-reference FP 10.
- `impact`: 13 proposals, 7 TP / 6 FP, precision 53.85%, zero-reference FP 5.
- `build`: 7 proposals, 2 TP / 5 FP, precision 28.57%, zero-reference FP 3.
- `breakdown`: 3 proposals, 1 TP / 2 FP, precision 33.33%, zero-reference FP 0.

## Strongest numeric feature separations

- `anchorFeature4Percentile`: SMD TP-FP +0.905; TP median 0.5846938775510204, FP median 0.10006498267128766.
- `semanticConfidence`: SMD TP-FP +0.759; TP median 0.87, FP median 0.83.
- `anchorFeature4`: SMD TP-FP +0.679; TP median 0.8081, FP median 0.7492.
- `anchorFeature2Percentile`: SMD TP-FP -0.299; TP median 0.9550053966540746, FP median 0.97.
- `anchorFeature3Percentile`: SMD TP-FP +0.281; TP median 0.9552620198922829, FP median 0.9677778616732106.
- `nextAnchorGapSeconds`: SMD TP-FP -0.223; TP median 0.8499999999999943, FP median 0.47700000000000387.
- `trackDropProposalCount`: SMD TP-FP -0.219; TP median 2.0, FP median 3.0.
- `anchorFeature2`: SMD TP-FP -0.138; TP median 3.0, FP median 3.0.

These are label-informed, post-hoc Stage1 diagnostics. They are evidence for V6 design hypotheses, not validated production thresholds and not terminal-holdout results.
