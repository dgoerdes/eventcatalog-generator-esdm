# Contributing

**Requires Node.js >= 22.12.0**

## Local example

Runnable EventCatalog CE project in `examples/catalog/`, wired to this plugin via `file:../..`.

From the repo root:

```bash
npm install
npm run catalog:demo
```

Open http://localhost:3000. More detail in [examples/catalog/README.md](examples/catalog/README.md).

## Development

```bash
npm install
npm test
npm run build
npm run esdm:lint
```

`esdm:lint` validates the Library Network model in `examples/catalog/models/library`.
