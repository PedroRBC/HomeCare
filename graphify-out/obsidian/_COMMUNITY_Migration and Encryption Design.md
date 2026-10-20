---
type: community
members: 4
---

# Migration and Encryption Design

**Members:** 4 nodes

## Members
- [[Idempotent and Resumable Data Migration]] - rationale - docs/data-migration.md
- [[Local Encrypted Firebase Data Migration]] - document - docs/data-migration.md
- [[Per-House Encryption Key Access Model]] - concept - docs/privacy-and-security.md
- [[Sensitive Field Encryption Model]] - rationale - docs/privacy-and-security.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Migration_and_Encryption_Design
SORT file.name ASC
```
