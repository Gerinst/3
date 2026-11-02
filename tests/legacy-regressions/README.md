# Archived routing regressions

These are unchanged synthetic mail fixtures from `Gerinst/2testordner` at commit `b9ada7d60cdb2ce76dfc06a90834cecce23ab422`.

| File | Original path | SHA-256 |
| --- | --- | --- |
| `H033.eml` | `test/blind/bodyhold/mails/H033.eml` | `1fada4f1bb8811ad1540ad018aec1c4d4db5e5355374dc042ff46fa20374b272` |
| `T203.eml` | `test/blind/sweep2/T2/mails/T203.eml` | `24a75177cbff9051b81eff12b1c3708de2826e9b900e8364093ad8338090d5de` |

H033 is a reply announcing a later payment, with no advice or attachment. T203 encloses an unapproved payment proposal and explicitly says that the advice will follow only after execution. Both remain unchanged in the inbox. `safety-semantics.cjs` also verifies that attached issued/unreadable advices and explicit cancellations still require review.
