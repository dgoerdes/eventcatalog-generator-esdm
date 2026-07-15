import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { escapeMdxLiterals, mapBoundedContextService, mapDomainUbiquitousLanguage, mapEsdmModel } from './mapper.js';
import { groupBoundedContexts, parseEsdmModel, resolveDomain } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryFixture = path.join(__dirname, '..', 'examples', 'catalog', 'models', 'library');

describe('parser', () => {
  it('parses the library fixture with two domains', async () => {
    const model = await parseEsdmModel(libraryFixture);

    expect(model.domains).toHaveLength(2);
    expect(model.domains.map((domain) => domain.name).sort()).toEqual(['collection-network', 'public-library']);
    expect(model.boundedContexts).toHaveLength(6);
    expect(model.subdomains).toHaveLength(2);
    expect(model.commands.length).toBeGreaterThan(0);
    expect(model.events.length).toBeGreaterThan(0);
    expect(model.queries.length).toBeGreaterThan(0);
    expect(model.aggregates.length).toBeGreaterThan(0);
    expect(model.readModels.length).toBeGreaterThan(0);
  });

  it('parses integration artifacts across both domains', async () => {
    const model = await parseEsdmModel(libraryFixture);

    expect(model.policies.length).toBeGreaterThan(0);
    expect(model.eventHandlers.length).toBeGreaterThan(0);
    expect(model.processManagers.length).toBeGreaterThan(0);
    expect(model.externalSystems).toHaveLength(2);
    expect(model.contextMappings.length).toBeGreaterThanOrEqual(5);
    expect(model.dynamicConsistencyBoundaries.length).toBeGreaterThan(0);
    expect(model.domainServices.length).toBeGreaterThan(0);
    expect(model.actors.length).toBeGreaterThan(0);
  });

  it('groups bounded contexts by domain', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const domain = resolveDomain(model, 'public-library');
    const contexts = groupBoundedContexts(model, domain);

    expect(contexts.size).toBe(3);
    expect(contexts.get('public-library/cataloging')?.commands.some((command) => command.name === 'acquire-book')).toBe(true);
  });
});

describe('mapper', () => {
  it('maps public-library to systems and consistency-unit services', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const mapped = mapEsdmModel(model, { id: 'public-library', name: 'Public Library', version: '1.0.0' });

    expect(mapped.systems.map((system) => system.id).sort()).toEqual(['cataloging', 'circulation', 'membership']);

    const bookService = mapped.services.find((service) => service.id === 'book');
    const catalogService = mapped.services.find((service) => service.id === 'catalog');

    expect(bookService?.sidebarBadge).toBe('Aggregate');
    expect(bookService?.badges?.[0]?.content).toBe('Aggregate');
    expect(catalogService?.sidebarBadge).toBe('Read Model');
    expect(catalogService?.badges?.[0]?.content).toBe('Read Model');

    const acquire = mapped.messages.find((message) => message.id === 'acquire-book');
    expect(acquire?.badges?.[0]?.content).toBe('Command');
    expect(mapped.messages.find((message) => message.id === 'book-acquired')?.badges?.[0]?.content).toBe('Event');
    expect(mapped.messages.find((message) => message.id === 'search-catalog')?.badges?.[0]?.content).toBe('Query');
  });

  it('maps library integration artifacts', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const publicLibrary = mapEsdmModel(model, { id: 'public-library', name: 'Public Library', version: '1.0.0' });
    const collectionNetwork = mapEsdmModel(model, { id: 'collection-network', name: 'Collection Network', version: '1.0.0' });

    expect(publicLibrary.domain.badges?.[0]?.content).toBe('Domain');
    expect(publicLibrary.systems.every((system) => system.badges?.[0]?.content === 'Bounded Context')).toBe(true);

    const policyServices = publicLibrary.services.filter((service) => service.esdmKind === 'policy');
    expect(policyServices.length).toBeGreaterThan(0);
    expect(policyServices.every((service) => service.placement === 'domain')).toBe(true);
    expect(policyServices.every((service) => service.badges?.[0]?.content === 'Policy')).toBe(true);

    const externalServices = publicLibrary.services.filter((service) => service.externalSystem);
    expect(externalServices.map((service) => service.id)).toEqual(['notification-service']);

    const circulationSystem = publicLibrary.systems.find((system) => system.id === 'circulation');
    expect(circulationSystem?.relationships.some((relationship) => relationship.id === 'cataloging')).toBe(true);
    expect(publicLibrary.systems.find((system) => system.id === 'cataloging')?.actors.length).toBeGreaterThan(0);

    const processManagers = [...publicLibrary.services, ...collectionNetwork.services].filter(
      (service) => service.esdmKind === 'process-manager'
    );
    expect(processManagers.map((service) => service.id).sort()).toEqual(['ill-fulfillment', 'loan-reminder']);

    const flows = [...publicLibrary.flows, ...collectionNetwork.flows];
    expect(flows.length).toBeGreaterThanOrEqual(2);
  });

  it('escapes curly braces in MDX prose but not in code blocks', () => {
    const input = 'Path /patrons/{patronId} and `{patronId}` plus:\n\n```json\n{"id": "{patronId}"}\n```\n';
    expect(escapeMdxLiterals(input)).toBe(
      'Path /patrons/\\{patronId\\} and `{patronId}` plus:\n\n```json\n{"id": "{patronId}"}\n```\n'
    );
  });

  it('includes system and resource diagrams in domain markdown', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const mapped = mapEsdmModel(model, { id: 'public-library', name: 'Public Library', version: '1.0.0' });

    expect(mapped.domain.markdown).toContain('## System Diagram');
    expect(mapped.domain.markdown).toContain('<ContextDiagram />');
    expect(mapped.domain.markdown).toContain('## Resource Diagram');
    expect(mapped.domain.markdown).toContain('<NodeGraph />');
    expect(mapped.domain.markdown).not.toContain(mapped.domain.summary!.trim().slice(0, 40));
  });

  it('does not duplicate name or summary in resource markdown bodies', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const mapped = mapEsdmModel(model, { id: 'public-library', name: 'Public Library', version: '1.0.0' });

    const bookService = mapped.services.find((service) => service.id === 'book');
    expect(bookService?.summary).toBeTruthy();
    expect(bookService?.markdown).not.toMatch(/^#\s/m);
    expect(bookService?.markdown).not.toContain(bookService!.summary!.trim().slice(0, 40));

    const command = mapped.messages.find((message) => message.id === 'acquire-book');
    expect(command?.summary).toBeTruthy();
    expect(command?.markdown).not.toMatch(/^#\s/m);
    expect(command?.markdown).not.toContain(command!.summary!.trim().slice(0, 40));
  });

  it('maps message and service schemas for EventCatalog schemaPath attachment', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const mapped = mapEsdmModel(model, { id: 'public-library', name: 'Public Library', version: '1.0.0' });

    const acquire = mapped.messages.find((message) => message.id === 'acquire-book');
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

    const catalogService = mapped.services.find((service) => service.id === 'catalog');
    expect(catalogService?.schema?.type).toBe('array');
    expect(catalogService?.markdown).not.toContain('## Schema');
  });

  it('keeps backward-compatible bounded context service helper', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const domain = resolveDomain(model, 'public-library');
    const context = groupBoundedContexts(model, domain).get('public-library/cataloging');

    expect(context).toBeDefined();

    const service = mapBoundedContextService(context!, '1.0.0');

    expect(service.id).toBe('cataloging');
    expect(service.messages.length).toBeGreaterThan(3);
    expect(service.messages.some((message) => message.id === 'acquire-book')).toBe(true);
  });

  it('merges bounded-context ubiquitous language into the domain dictionary', async () => {
    const model = await parseEsdmModel(libraryFixture);
    const mapped = mapEsdmModel(model, { id: 'public-library', name: 'Public Library', version: '1.0.0' });

    expect(mapped.ubiquitousLanguage.map((term) => term.name).sort()).toEqual([
      'Copy',
      'Hold',
      'Loan',
      'Loan limit',
      'Patron',
      'Renewal',
      'Suspension (Circulation)',
      'Suspension (Membership)',
      'Title',
      'Withdraw',
    ]);

    const membershipSuspension = mapped.ubiquitousLanguage.find((term) => term.name === 'Suspension (Membership)');
    const circulationSuspension = mapped.ubiquitousLanguage.find((term) => term.name === 'Suspension (Circulation)');

    expect(membershipSuspension?.id).toBe('suspension-membership');
    expect(membershipSuspension?.summary).toContain('borrowing');
    expect(circulationSuspension?.id).toBe('suspension-circulation');
    expect(circulationSuspension?.summary).toContain('copy');
    expect(circulationSuspension?.description).toContain('**Avoid:**');

    const title = mapped.ubiquitousLanguage.find((term) => term.name === 'Title');
    expect(title?.id).toBe('title');
    expect(title?.summary).toContain('ISBN');
    expect(title?.description).toContain('**Avoid:**');
    expect(title?.description).toContain('Book');
  });

  it('disambiguates duplicate ubiquitous language terms with bounded-context names', () => {
    const domain = {
      apiVersion: 'schema.esdm.io/core/v1',
      kind: 'domain' as const,
      name: 'demo',
    };
    const contexts = [
      {
        domain,
        boundedContext: {
          apiVersion: 'schema.esdm.io/core/v1',
          kind: 'bounded-context' as const,
          name: 'membership',
          scope: { domain: 'demo' },
          ubiquitousLanguage: [{ term: 'Suspension', definition: 'Membership suspension policy.' }],
        },
        aggregates: [],
        dynamicConsistencyBoundaries: [],
        readModels: [],
        domainServices: [],
        commands: [],
        events: [],
        queries: [],
        actors: [],
      },
      {
        domain,
        boundedContext: {
          apiVersion: 'schema.esdm.io/core/v1',
          kind: 'bounded-context' as const,
          name: 'circulation',
          scope: { domain: 'demo' },
          ubiquitousLanguage: [{ term: 'Suspension', definition: 'Circulation suspension for overdue items.' }],
        },
        aggregates: [],
        dynamicConsistencyBoundaries: [],
        readModels: [],
        domainServices: [],
        commands: [],
        events: [],
        queries: [],
        actors: [],
      },
    ];

    const terms = mapDomainUbiquitousLanguage(contexts);

    expect(terms.map((term) => term.name).sort()).toEqual([
      'Suspension (Circulation)',
      'Suspension (Membership)',
    ]);
    expect(terms.map((term) => term.id).sort()).toEqual(['suspension-circulation', 'suspension-membership']);
  });
});
