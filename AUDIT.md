## Bug 1 — SQL Injection

### Root Cause
Raw user input was directly concatenated into SQL query strings.

### Fix
Replaced string concatenation with parameterized PostgreSQL queries using $1 placeholders.

### Verification
Injection payload now returns safe filtered results instead of exposing database records.