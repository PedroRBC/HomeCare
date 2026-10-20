---
type: community
members: 12
---

# Consent Queues and Logging

**Members:** 12 nodes

## Members
- [[ConsentRecordService]] - code - src/services/consentRecords.ts
- [[TelemetryService]] - code - src/services/firebase.ts
- [[Ticket]] - code - src/services/consentRecords.ts
- [[changedPurposes()]] - code - src/utils/privacy.ts
- [[consentRecords.ts]] - code - src/services/consentRecords.ts
- [[createSerialQueue()]] - code - src/utils/serialQueue.ts
- [[logger]] - code - src/utils/logger.ts
- [[logger.ts]] - code - src/utils/logger.ts
- [[queues]] - code - src/services/consentRecords.ts
- [[serialQueue.test.ts]] - code - src/utils/serialQueue.test.ts
- [[serialQueue.ts]] - code - src/utils/serialQueue.ts
- [[sleep()]] - code - src/utils/serialQueue.test.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Consent_Queues_and_Logging
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_Authentication and Provider Linking]]
- 4 edges to [[_COMMUNITY_Firebase Telemetry and Errors]]
- 3 edges to [[_COMMUNITY_Privacy Consent Domain]]
- 3 edges to [[_COMMUNITY_Caregiver Shifts and Exports]]
- 2 edges to [[_COMMUNITY_Scheduling and Payments]]
- 2 edges to [[_COMMUNITY_House Context and Navigation]]
- 2 edges to [[_COMMUNITY_Privacy Configuration Tests]]
- 1 edge to [[_COMMUNITY_House Scoped Firestore]]
- 1 edge to [[_COMMUNITY_Privacy and Consent Screens]]
- 1 edge to [[_COMMUNITY_Consent Record Concurrency Tests]]

## Top bridge nodes
- [[consentRecords.ts]] - degree 17, connects to 7 communities
- [[logger.ts]] - degree 6, connects to 4 communities
- [[logger]] - degree 6, connects to 4 communities
- [[TelemetryService]] - degree 3, connects to 2 communities
- [[serialQueue.test.ts]] - degree 5, connects to 1 community