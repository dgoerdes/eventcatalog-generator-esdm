# ESDM Generator for EventCatalog

Generate [EventCatalog](https://www.eventcatalog.dev/) domains, systems, services, and messages from [ESDM](https://www.esdm.io/) (Event-Sourced Domain Modeling) YAML models.

This is a one-way generator: ESDM `.esdm.yaml` files in, EventCatalog resources on disk out — the same model as the official OpenAPI and AsyncAPI plugins.

## Scope

**v0.1 is intentionally one-way.** ESDM → EventCatalog only. Bidirectional sync (write-back to ESDM) would require conflict resolution, round-trip fidelity for prose rules, and a much larger SDK surface (`rm`*, diffing, merge). That is a separate project.

## Mapping

ESDM's hierarchy maps to EventCatalog 4.0 systems and services:

| ESDM concept                   | EventCatalog resource      | Notes                                                          |
| ------------------------------ | -------------------------- | -------------------------------------------------------------- |
| `domain`                       | Domain                     | Via config, validated against ESDM                             |
| `bounded-context`              | System                     | Grouped under the domain; owns consistency-unit services       |
| `aggregate`                    | Service                    | Badge: `Aggregate`; owns scoped commands/events                |
| `dynamic-consistency-boundary` | Service                    | Badge: `DCB`; owns DCB commands and emitted BC events          |
| `read-model`                   | Service                    | Badge: `Read Model`; owns queries and projected events         |
| `domain-service`               | Service                    | Badge: `Domain Service`; stateless domain operations           |
| `command` / `event` / `query`  | Message                    | Owned by the matching consistency-unit service                 |
| `external-system`              | External service           | `externalSystem: true` at domain level                         |
| `policy`                       | Integration service        | Badge: `Policy`; domain-scoped `handles` / `emits`             |
| `event-handler`                | Integration service        | Badge: `Event Handler`; side effects in markdown               |
| `process-manager`              | Integration service + Flow | Badge: `Process Manager`; flow documents reactions             |
| `context-mapping`              | System `relationships`     | BC-to-BC mappings; external endpoints noted in system markdown |
| `actor`                        | System `actors`            | Mapped from BC-scoped actors                                   |
| `metadata.labels`              | Service `badges`           | Tag-like passthrough                                           |

**Why bounded context → system?** EventCatalog systems describe software capabilities made of cooperating resources. ESDM bounded contexts are that layer — aggregates, DCBs, and read models are consistency units inside them, not deployable boundaries on their own.

## Installation

```bash
npm install @dgoerdes/eventcatalog-generator-esdm
```

## Configuration

Register the generator in `eventcatalog.config.js`:

```js
const path = require('path');

module.exports = {
  // ...catalog config
  generators: [
    [
      '@dgoerdes/eventcatalog-generator-esdm',
      {
        models: [
          {
            path: path.join(__dirname, 'models/craven'),
            version: '1.0.0',
          },
        ],
        domain: {
          id: 'craven',
          name: 'Craven',
          version: '1.0.0',
        },
        systems: [
          {
            boundedContext: 'tenant-management',
            name: 'Tenant Management',
          },
        ],
        units: [
          {
            boundedContext: 'tenant-management',
            unit: 'tenant',
            name: 'Tenant Aggregate',
          },
        ],
        debug: true,
        saveSourceFiles: true,
      },
    ],
  ],
};
```

### Options

| Option            | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `models`          | Array of ESDM model sources. `path` can be a directory (scans `**/*.esdm.yaml`), a single file, or a URL.   |
| `domain`          | EventCatalog domain to group generated systems under. `id` should match the ESDM domain name when possible. |
| `systems`         | Optional per–bounded-context overrides for system `id`, `name`, `version`, `owners`, `draft`.               |
| `services`        | Deprecated alias for `systems`.                                                                             |
| `units`           | Optional per–consistency-unit overrides (`boundedContext` + `unit` name).                                   |
| `integration`     | Optional overrides for policies, event-handlers, process-managers, and external systems.                    |
| `debug`           | Verbose logging. Also enabled via `npm run generate -- debug`.                                              |
| `saveSourceFiles` | Attach source `.esdm.yaml` files to each generated service (default: `true`).                               |

## Generate

From your EventCatalog project:

```bash
npm run generate
# or with debug output
npm run generate -- debug
```

## Try it locally (EventCatalog CE)

This repo includes a runnable EventCatalog Community Edition project under `examples/catalog/`. It uses the local plugin via `file:../..` and the Craven ESDM model as a real-world example.

```bash
npm install
npm run catalog:demo
```

Open [http://localhost:3000](http://localhost:3000) — you should see the **Craven** domain, **Tenant Management** and **Compliance Management** systems, consistency-unit services, integration services, and external systems.

**Requires Node.js >= 22.12.0** (current EventCatalog / Astro requirement).

See [examples/catalog/README.md](examples/catalog/README.md) for step-by-step commands.

## Development

```bash
npm install
npm test
npm run build
```

The `src/test/fixtures/library` directory contains the [ESDM first-model tutorial](https://www.esdm.io/getting-started/your-first-model/) as test fixtures. The bundled `src/test/esdm` binary can lint fixtures locally:

```bash
./src/test/esdm lint -d src/test/fixtures/library
```

## TODO:

- [ ] Assign better colors for Kind badges (match command, query, event with event catalog colors).
- [ ] Message Flow seems to be inverted, Aggregate has to emit events not consume them. And they receive commands.

## License

MIT
