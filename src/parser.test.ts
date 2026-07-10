import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapBoundedContextService } from './mapper.js';
import { groupBoundedContexts, parseEsdmModel, resolveDomain } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryFixture = path.join(__dirname, 'test', 'fixtures', 'library');

describe('parser', () => {
  it('parses the library fixture', async () => {
    const model = await parseEsdmModel(libraryFixture);

    expect(model.domains).toHaveLength(1);
    expect(model.domains[0].name).toBe('library');
    expect(model.boundedContexts).toHaveLength(1);
    expect(model.commands).toHaveLength(1);
    expect(model.events).toHaveLength(1);
    expect(model.queries).toHaveLength(1);
    expect(model.aggregates).toHaveLength(1);
    expect(model.readModels).toHaveLength(1);
  });

  it('groups bounded contexts by domain', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const domain = resolveDomain(model);
    const contexts = groupBoundedContexts(model, domain);

    expect(contexts.size).toBe(1);
    expect(contexts.get('library/cataloging')?.commands[0].name).toBe('acquire');
  });
});

describe('mapper', () => {
  it('maps a bounded context to an EventCatalog service with messages', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const domain = resolveDomain(model);
    const context = groupBoundedContexts(model, domain).get('library/cataloging');

    expect(context).toBeDefined();

    const service = mapBoundedContextService(context!, '1.0.0');

    expect(service.id).toBe('cataloging');
    expect(service.name).toBe('Cataloging');
    expect(service.messages).toHaveLength(3);
    expect(service.messages.map((message) => message.id).sort()).toEqual(['acquire', 'acquired', 'list-books']);
    expect(service.sends).toEqual([{ id: 'acquire', version: '1.0.0' }]);
    expect(service.receives).toEqual([
      { id: 'acquired', version: '1.0.0' },
      { id: 'list-books', version: '1.0.0' },
    ]);
  });
});
