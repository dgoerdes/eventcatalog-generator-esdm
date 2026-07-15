# EventCatalog + ESDM example

Runnable [EventCatalog Community Edition](https://www.eventcatalog.dev/) project that uses the local ESDM generator from this repository.

The `models/library` directory contains a comprehensive **Library Network** domain model with two domains:

- **Public Library** — patron-facing cataloging, circulation, and membership
- **Collection Network** — acquisitions, inter-library loan, and preservation

Running `generate` produces both EventCatalog domains with bounded-context systems, consistency-unit services, integration artifacts (policies, event handlers, process managers, flows), external systems, and messages.

## Quick start

From the **repository root**:

```bash
npm install
npm run catalog:demo
```

Then open http://localhost:3000

**Requires Node.js >= 22.12.0** (EventCatalog / Astro requirement as of v4).

## Step by step

From the repository root:

```bash
# 1. Build the generator plugin
npm run build

# 2. Install EventCatalog in the example project
npm run catalog:install

# 3. Generate catalog resources from ESDM
npm run catalog:generate

# 4. Start the dev server
npm run catalog:dev
```

Or run everything inside `examples/catalog`:

```bash
cd examples/catalog
npm install
npm run generate
npm run dev
```

## Regenerating after plugin changes

Rebuild the generator, then re-run generate:

```bash
npm run build
npm run catalog:generate
```

Generated domains, systems, services, and messages are gitignored here so the example always reflects the current plugin output.

## Lint the ESDM model

From the repository root:

```bash
npm run esdm:lint
```
