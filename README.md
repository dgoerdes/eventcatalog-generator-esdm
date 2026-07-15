# ESDM Generator for EventCatalog

Generate [EventCatalog](https://www.eventcatalog.dev/) domains, systems, services, and messages from [ESDM](https://www.esdm.io/) YAML models.

One-way generator: ESDM `.esdm.yaml` in → EventCatalog resources on disk out.

## Mapping

ESDM maps to EventCatalog 4.0. Bounded contexts become systems; consistency units inside them become services.

| ESDM concept                                   | EventCatalog resource      |
| ---------------------------------------------- | -------------------------- |
| `domain`                                       | Domain (via config)        |
| `bounded-context`                              | System                     |
| `aggregate`                                    | Service (`Aggregate`)      |
| `dynamic-consistency-boundary`                 | Service (`DCB`)            |
| `read-model`                                   | Service (`Read Model`)     |
| `domain-service`                               | Service (`Domain Service`) |
| `command` / `event` / `query`                  | Message                    |
| `external-system`                              | External service           |
| `policy` / `event-handler` / `process-manager` | Integration service        |
| `process-manager`                              | + Flow                     |
| `context-mapping`                              | System relationships       |
| `actor`                                        | System actors              |
| `bounded-context.ubiquitousLanguage`           | Domain ubiquitous language |
| `metadata.labels`                              | Service badges             |

## Installation

```bash
npm install eventcatalog-generator-esdm
```

## Configuration

Register the generator in `eventcatalog.config.js`:

```js
const path = require('path');

module.exports = {
  generators: [
    [
      'eventcatalog-generator-esdm',
      {
        models: [{ path: path.join(__dirname, 'models'), version: '1.0.0' }],
        domain: { id: 'my-domain', name: 'My Domain', version: '1.0.0' },
      },
    ],
  ],
};
```

### Options

| Option            | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| `models`          | ESDM sources — directory, file, or URL (`**/*.esdm.yaml`)            |
| `domain`          | EventCatalog domain for generated systems                            |
| `systems`         | Per–bounded-context overrides (`id`, `name`, `version`, …)           |
| `units`           | Per–consistency-unit overrides (`boundedContext` + `unit`)           |
| `integration`     | Overrides for policies, handlers, process managers, external systems |
| `debug`           | Verbose logging (`npm run generate -- debug`)                        |
| `saveSourceFiles` | Attach source `.esdm.yaml` to services (default: `true`)             |

See [CONTRIBUTING.md](CONTRIBUTING.md) to run the example catalog locally.

## License

MIT
