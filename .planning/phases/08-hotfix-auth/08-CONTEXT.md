# Phase 08 Context: Auth Hotfix

## Situation
The `get_current_user` dependency incorrectly revokes valid tokens due to a float vs integer comparison on timestamps.

## Goal
Fix the `iat` vs `token_valid_after` comparison in `src/app/core/security.py`.

## Constraints
- Must not break existing auth database compatibility.
- Must be deployed immediately.

## Solution
Cast `token_valid_after` to an integer (floor) before comparison, or allow a 1-second grace period.
