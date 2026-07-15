import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryModelPath = path.join(__dirname, 'models', 'library');

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  cId: '00000000-0000-0000-0000-000000000001',
  title: 'Library Network Demo',
  tagline: 'EventCatalog demo generated from the Library Network ESDM model',
  organizationName: 'Library Network Demo',
  homepageLink: 'https://github.com/dgoerdes/eventcatalog-generator-esdm',
  trailingSlash: false,
  base: '/',

  logo: {
    src: '/logo.png',
    text: 'Library Network Demo',
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
            path: libraryModelPath,
            version: '1.0.0',
          },
        ],
        domain: {
          id: 'public-library',
          name: 'Public Library',
          version: '1.0.0',
        },
        debug: true,
      },
    ],
    [
      '@dgoerdes/eventcatalog-generator-esdm',
      {
        models: [
          {
            path: libraryModelPath,
            version: '1.0.0',
          },
        ],
        domain: {
          id: 'collection-network',
          name: 'Collection Network',
          version: '1.0.0',
        },
        debug: true,
      },
    ],
  ],

  theme: 'sunset',
  repositoryUrl: 'https://github.com/dgoerdes/eventcatalog-generator-esdm',
};
