---
type: community
members: 12
---

# Privacy Consent Domain

**Members:** 12 nodes

## Members
- [[ConsentChoice]] - code - src/utils/privacy.ts
- [[PRIVACY_POLICY_VERSION]] - code - src/utils/privacy.ts
- [[PolicyAcceptance]] - code - src/utils/privacy.ts
- [[TELEMETRY_PURPOSES]] - code - src/utils/privacy.ts
- [[TERMS_VERSION]] - code - src/utils/privacy.ts
- [[needsConsent()]] - code - src/utils/privacy.ts
- [[privacy.test.ts]] - code - src/utils/privacy.test.ts
- [[restrictTelemetry()]] - code - src/utils/privacy.ts
- [[sameTelemetry()]] - code - src/utils/privacy.ts
- [[sanitizeAnalyticsParams()]] - code - src/utils/privacy.ts
- [[utilsprivacy.ts]] - code - src/utils/privacy.ts
- [[withPendingRevocation()]] - code - src/utils/privacy.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Privacy_Consent_Domain
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_Privacy and Consent Screens]]
- 7 edges to [[_COMMUNITY_Navigation and Route Types]]
- 5 edges to [[_COMMUNITY_Authentication and Provider Linking]]
- 3 edges to [[_COMMUNITY_House Scoped Firestore]]
- 3 edges to [[_COMMUNITY_Consent Queues and Logging]]
- 3 edges to [[_COMMUNITY_Firebase Telemetry and Errors]]
- 2 edges to [[_COMMUNITY_Privacy Configuration Tests]]
- 1 edge to [[_COMMUNITY_Forms and Authentication Validation]]
- 1 edge to [[_COMMUNITY_Caregiver Shifts and Exports]]
- 1 edge to [[_COMMUNITY_Consent Record Concurrency Tests]]

## Top bridge nodes
- [[utilsprivacy.ts]] - degree 28, connects to 8 communities
- [[privacy.test.ts]] - degree 12, connects to 3 communities
- [[restrictTelemetry()]] - degree 5, connects to 3 communities
- [[needsConsent()]] - degree 5, connects to 2 communities
- [[sameTelemetry()]] - degree 4, connects to 2 communities