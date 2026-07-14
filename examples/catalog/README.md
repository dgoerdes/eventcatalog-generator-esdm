# EventCatalog + ESDM example

Runnable [EventCatalog Community Edition](https://www.eventcatalog.dev/) project that uses the local ESDM generator from this repository.

The `models/craven` directory contains a real-world Craven SaaS domain model. Running `generate` produces:

- **Domain:** Craven
- **Systems:** Tenant Management, Compliance Management (from bounded contexts)
- **Services:** Aggregates, DCBs, read models, domain services, policies, event handlers, and external systems
- **Messages:** Commands, events, and queries scoped to their consistency units

The `models/library` directory is still available as a minimal tutorial fixture used by unit tests.

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
