# ESDM Generator for EventCatalog

Generate [EventCatalog](https://www.eventcatalog.dev/) domains, services, and messages from [ESDM](https://www.esdm.io/) (Event-Sourced Domain Modeling) YAML models.

This is a one-way generator: ESDM `.esdm.yaml` files in, EventCatalog resources on disk out — the same model as the official OpenAPI and AsyncAPI plugins.

## Scope

**v0.1 is intentionally one-way.** ESDM → EventCatalog only. Bidirectional sync (write-back to ESDM) would require conflict resolution, round-trip fidelity for prose rules, and a much larger SDK surface (`rm*`, diffing, merge). That is a separate project.

## Mapping

ESDM's hierarchy is deeper than EventCatalog's flat Domain → Service → Messages model. This generator uses:

| ESDM concept | EventCatalog resource |
|---|---|
| `domain` | Domain (via config, validated against ESDM) |
| `bounded-context` | Service |
| `command` | Command |
| `event` | Event |
| `query` | Query |
| `aggregate`, `read-model` | Documented in service markdown |
| `external-system` | Planned (separate external service) |
| `policy`, `process-manager`, `context-mapping` | Planned |

**Why bounded context → service?** It matches how teams usually own deployable units, aligns with the AsyncAPI plugin (one spec file → one service), and keeps aggregates as implementation detail inside the service rather than exploding the catalog with one service per aggregate.

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
            path: path.join(__dirname, 'models/library'),
            version: '1.0.0',
          },
          // Remote model
          {
            path: 'https://example.com/models/orders.esdm.yaml',
            headers: { Authorization: 'Bearer ...' },
          },
        ],
        domain: {
          id: 'library',
          name: 'Library',
          version: '1.0.0',
        },
        services: [
          {
            boundedContext: 'cataloging',
            id: 'cataloging-service',
            name: 'Cataloging Service',
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

| Option | Description |
|---|---|
| `models` | Array of ESDM model sources. `path` can be a directory (scans `**/*.esdm.yaml`), a single file, or a URL. |
| `domain` | EventCatalog domain to group generated services under. `id` should match the ESDM domain name when possible. |
| `services` | Optional per–bounded-context overrides for service `id`, `name`, `version`, `owners`, `draft`. |
| `debug` | Verbose logging. Also enabled via `npm run generate -- debug`. |
| `saveSourceFiles` | Attach source `.esdm.yaml` files to each generated service (default: `true`). |

## Generate

From your EventCatalog project:

```bash
npm run generate
# or with debug output
npm run generate -- debug
```

## Try it locally (EventCatalog CE)

This repo includes a runnable EventCatalog Community Edition project under `examples/catalog/`. It uses the local plugin via `file:../..` and the library ESDM model from the [ESDM tutorial](https://www.esdm.io/getting-started/your-first-model/).

```bash
npm install
npm run catalog:demo
```

Open http://localhost:3000 — you should see the **Library** domain, **Cataloging** service, and the `acquire` / `acquired` / `list-books` messages.

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

## Roadmap

- [ ] External systems as dedicated services
- [ ] Policies and process managers as cross-service `writesTo` / `readsFrom` links
- [ ] Context mappings as service relationships or flows
- [ ] Given-When-Then and Domain Storytelling extensions
- [ ] Optional `esdm lint` integration during generate
- [ ] `metadata.annotations` hooks for EventCatalog-specific overrides

## License

MIT
