# Test fixtures

## theme-schema.json

Verbatim copy of Pi's theme JSON schema, fetched from

    https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json

(the same URL the bundled themes reference in their `$schema` field).

It is committed so the schema-validation release gate runs deterministically
and offline. Refresh it when bumping the Pi peer-dependency floor: the schema
is the contract for what `theme-schema` validation and the token-completeness
check enforce.
