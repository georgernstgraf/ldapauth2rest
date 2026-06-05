# Domain Knowledge

Business rules and domain relationships not obvious from code.

## Entities
- **Service Account**: An LDAP user with search permissions. Used to search for end users. Must not authenticate as an end user (#SUF rejection).
- **End User**: A person in the LDAP directory being authenticated. Identified by `cn` attribute.
- **Failure Tracker**: In-memory Map tracking failed auth attempts by `ip:user` token. Blocks after `IP_FAIL_MAX` failures within `IP_FAIL_PERIOD` seconds.

## Rules
- Service DN check: if the authenticated user ID is a substring of the service DN (case-insensitive), reject as #SUF (Service User Forbidden)
- User minimum length: 3 characters (#UTS — User Too Short)
- Wildcards/brackets in username: reject (#NBW — No Brackets or Wildcards)
- Single result required: LDAP search must return exactly 1 entry; 0 = #NU0, >1 = #NU{N}
- Auth flow: search LDAP for user DN → try bind with user DN + password → bind success = auth OK
- Password never logged; replaced with `*` characters in log output

## LDAP Attributes Retrieved
- `dn` — distinguished name
- `mail` — email address
- `displayName` — display name
- `physicalDeliveryOfficeName` — office location
- `description` — user description
