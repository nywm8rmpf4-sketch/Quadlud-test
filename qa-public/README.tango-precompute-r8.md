# QUADLUD Tango precompute R8 QA

Copyright © 2026 Serge Benoliel. All rights reserved.

This QA branch validates runtime materialization for the Soleil-Lune 120x4 certified pool and guarded Tutor cache. Product promotion remains blocked until target ambiguity audit, runtime-data contract, Web/PWA integration, and non-regression gates pass.

## Permanent Tutor/cache synchronization invariant

The precomputed Tutor cache is not a second Tutor algorithm. It is the offline materialization of the current live Tutor algorithm for the exact certified puzzle pool.

Any change that can alter Tutor move selection, human-cost ordering, direct/advanced deduction availability, proof construction, or canonical Tutor progression MUST invalidate and regenerate the offline Tutor cache before a candidate can pass QA.

For every canonical visible state of every certified cached puzzle, QA MUST demonstrate cache/live parity against the current Tutor with the cache disabled: same target, same value, and same starting/display proof. Canonical Tutor journeys require 100% cache hits, 0 key misses, 0 rebuild rejects, and 0 cache/live mismatches. Live fallback remains permitted only after the player diverges from a precomputed canonical visible state, or when a puzzle/state is explicitly outside the certified cache contract.
