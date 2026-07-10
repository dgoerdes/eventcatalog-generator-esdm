import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  cId: '00000000-0000-0000-0000-000000000001',
  title: 'Library Catalog',
  tagline: 'EventCatalog demo generated from an ESDM model',
  organizationName: 'Library Demo',
  homepageLink: 'https://www.esdm.io/',
  editUrl: 'https://github.com/dgoerdes/eventcatalog-generator-esdm/edit/main',
  trailingSlash: false,
  base: '/',
  logo: {
    alt: 'EventCatalog Logo',
    src: '/logo.png',
    text: 'Library Demo',
  },
  docs: {
    sidebar: {
      showPageHeadings: true,
    },
  },
  generators: [
    [
      '@dgoerdes/eventcatalog-generator-esdm',
      {
        models: [
          {
            path: path.join(__dirname, 'models', 'library'),
            version: '1.0.0',
          },
        ],
        domain: {
          id: 'library',
          name: 'Library',
          version: '1.0.0',
        },
        debug: true,
      },
    ],
  ],
};
