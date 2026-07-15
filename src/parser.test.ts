import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { escapeMdxLiterals, mapBoundedContextService, mapEsdmModel } from './mapper.js';
import { groupBoundedContexts, parseEsdmModel, resolveDomain } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryFixture = path.join(__dirname, 'test', 'fixtures', 'library');
const cravenFixture = path.join(__dirname, '..', 'examples', 'catalog', 'models', 'craven');

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

  it('parses the craven fixture with integration artifacts', async () => {
    const model = await parseEsdmModel(cravenFixture);

    expect(model.domains[0].name).toBe('craven');
    expect(model.boundedContexts.length).toBeGreaterThanOrEqual(2);
    expect(model.policies.length).toBeGreaterThan(0);
    expect(model.eventHandlers.length).toBeGreaterThan(0);
    expect(model.externalSystems.length).toBe(2);
    expect(model.contextMappings.length).toBe(4);
    expect(model.dynamicConsistencyBoundaries.length).toBeGreaterThan(0);
    expect(model.domainServices.length).toBeGreaterThan(0);
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
  it('maps library to systems and consistency-unit services', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const mapped = mapEsdmModel(model, { id: 'library', name: 'Library', version: '1.0.0' });

    expect(mapped.systems).toHaveLength(1);
    expect(mapped.systems[0].id).toBe('cataloging');
    expect(mapped.systems[0].services.map((service) => service.id).sort()).toEqual(['book', 'books']);

    const bookService = mapped.services.find((service) => service.id === 'book');
    const booksService = mapped.services.find((service) => service.id === 'books');

    expect(bookService?.sidebarBadge).toBe('Aggregate');
    expect(bookService?.badges?.[0]).toMatchObject({ content: 'Aggregate', backgroundColor: '#2563eb', textColor: '#ffffff' });
    expect(bookService?.messages.map((message) => message.id).sort()).toEqual(['acquire', 'acquired']);
    expect(booksService?.sidebarBadge).toBe('Read Model');
    expect(booksService?.badges?.[0]).toMatchObject({ content: 'Read Model', backgroundColor: '#16a34a', textColor: '#ffffff' });
    expect(booksService?.messages.map((message) => message.id)).toEqual(['list-books', 'acquired']);

    const acquire = mapped.messages.find((message) => message.id === 'acquire');
    expect(acquire?.badges?.[0]?.content).toBe('Command');
    expect(mapped.messages.find((message) => message.id === 'acquired')?.badges?.[0]?.content).toBe('Event');
    expect(mapped.messages.find((message) => message.id === 'list-books')?.badges?.[0]?.content).toBe('Query');
  });

  it('maps craven integration artifacts', async () => {
    const model = await parseEsdmModel(cravenFixture);
    const mapped = mapEsdmModel(model, { id: 'craven', name: 'Craven', version: '1.0.0' });

    expect(mapped.domain.badges?.[0]).toMatchObject({ content: 'Domain', backgroundColor: '#0d9488' });
    expect(mapped.systems.every((system) => system.badges?.[0]?.content === 'Bounded Context')).toBe(true);

    const command = mapped.messages.find((message) => message.id === 'add-domain-urls');
    expect(command?.badges?.[0]).toMatchObject({ content: 'Command', backgroundColor: '#db2777' });

    const event = mapped.messages.find((message) => message.id === 'added');
    expect(event?.badges?.[0]).toMatchObject({ content: 'Event', backgroundColor: '#d97706' });

    const query = mapped.messages.find((message) => message.id === 'get-domain');
    expect(query?.badges?.[0]).toMatchObject({ content: 'Query', backgroundColor: '#6366f1' });

    expect(mapped.systems.map((system) => system.id).sort()).toEqual(['compliance-management', 'tenant-management']);

    const policyServices = mapped.services.filter((service) => service.esdmKind === 'policy');
    expect(policyServices.length).toBeGreaterThan(0);
    expect(policyServices.every((service) => service.placement === 'domain')).toBe(true);
    expect(policyServices.every((service) => service.badges?.[0]?.content === 'Policy')).toBe(true);
    expect(policyServices.every((service) => service.badges?.[0]?.backgroundColor === '#dc2626')).toBe(true);

    const externalServices = mapped.services.filter((service) => service.externalSystem);
    expect(externalServices.map((service) => service.id).sort()).toEqual(['amazon-cognito', 'aws-bedrock']);
    expect(externalServices.every((service) => service.badges?.[0]?.content === 'External')).toBe(true);
    expect(externalServices.every((service) => service.badges?.[0]?.backgroundColor === '#4b5563')).toBe(true);

    const tenantSystem = mapped.systems.find((system) => system.id === 'tenant-management');
    expect(tenantSystem?.relationships.some((relationship) => relationship.id === 'compliance-management')).toBe(true);
    expect(tenantSystem?.actors.length).toBeGreaterThan(0);
    expect(tenantSystem?.markdown).toContain('\\{tenantId\\}');
    expect(tenantSystem?.markdown).not.toMatch(/[^\\]\{tenantId\}/);
  });

  it('escapes curly braces in MDX prose but not in code blocks', () => {
    const input = 'Path /tenants/{tenantId} and `{tenantId}` plus:\n\n```json\n{"id": "{tenantId}"}\n```\n';
    expect(escapeMdxLiterals(input)).toBe(
      'Path /tenants/\\{tenantId\\} and `{tenantId}` plus:\n\n```json\n{"id": "{tenantId}"}\n```\n'
    );
  });

  it('does not duplicate name or summary in resource markdown bodies', async () => {
    const model = await parseEsdmModel(cravenFixture);
    const mapped = mapEsdmModel(model, { id: 'craven', name: 'Craven', version: '1.0.0' });

    const domainService = mapped.services.find((service) => service.id === 'domain');
    expect(domainService?.summary).toBeTruthy();
    expect(domainService?.markdown).not.toMatch(/^#\s/m);
    expect(domainService?.markdown).not.toContain(domainService!.summary!.trim().slice(0, 40));

    const command = mapped.messages.find((message) => message.id === 'add-domain-urls');
    expect(command?.summary).toBeTruthy();
    expect(command?.markdown).not.toMatch(/^#\s/m);
    expect(command?.markdown).not.toContain(command!.summary!.trim().slice(0, 40));
  });

  it('maps message and service schemas for EventCatalog schemaPath attachment', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const mapped = mapEsdmModel(model, { id: 'library', name: 'Library', version: '1.0.0' });

    const acquire = mapped.messages.find((message) => message.id === 'acquire');
    expect(acquire?.schema?.type).toBe('object');
    expect(acquire?.schema?.properties).toMatchObject({
      isbn: { type: 'string' },
    });
    expect(acquire?.markdown).not.toContain('## Schema');

    const bookService = mapped.services.find((service) => service.id === 'book');
    expect(bookService?.schema?.type).toBe('object');
    expect(bookService?.schema?.properties).toMatchObject({
      isbn: { type: 'string' },
    });
    expect(bookService?.markdown).not.toContain('## Schema');

    const booksService = mapped.services.find((service) => service.id === 'books');
    expect(booksService?.schema?.type).toBe('array');
    expect(booksService?.markdown).not.toContain('## Schema');
  });

  it('keeps backward-compatible bounded context service helper', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const domain = resolveDomain(model);
    const context = groupBoundedContexts(model, domain).get('library/cataloging');

    expect(context).toBeDefined();

    const service = mapBoundedContextService(context!, '1.0.0');

    expect(service.id).toBe('cataloging');
    expect(service.messages).toHaveLength(3);
    expect(service.messages.map((message) => message.id).sort()).toEqual(['acquire', 'acquired', 'list-books']);
  });
});
