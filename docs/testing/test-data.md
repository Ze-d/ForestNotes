# Test Data

## Fixtures Location

Test fixtures live in `tests/fixtures/`. Do not import from production data sources in tests.

## Current Fixtures

| Fixture | Used By | Purpose |
|---------|---------|---------|
| (none yet) | — | Integration/E2E test data TBD |

## Conventions

- Markdown test files go in `tests/fixtures/markdown/`
- Tag test data goes in `tests/fixtures/tags/`
- Forest graph test data goes in `tests/fixtures/forest/`
- Sample database dumps go in `tests/fixtures/db/`

## Unit Test Data

Unit tests in `src/**/__tests__/` use inline data — no fixtures needed.
