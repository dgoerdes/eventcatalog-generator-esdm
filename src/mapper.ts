import type {
  BoundedContextContext,
  ConsistencyUnitKind,
  ConsistencyUnitOverride,
  DomainConfig,
  EsdmActor,
  EsdmAggregate,
  EsdmCommandReference,
  EsdmContextMapping,
  EsdmBoundedContext,
  EsdmDomain,
  EsdmDomainService,
  EsdmDynamicConsistencyBoundary,
  EsdmEvent,
  EsdmEventHandler,
  EsdmEventReference,
  EsdmExternalSystem,
  EsdmMappingEndpoint,
  EsdmPolicy,
  EsdmProcessManager,
  EsdmReadModel,
  IntegrationOverride,
  MappedDomain,
  MappedFlow,
  MappedMessage,
  MappedModel,
  MappedService,
  MappedUbiquitousLanguageTerm,
  MappedSystem,
  MappedSystemActor,
  MappedSystemRelationship,
  ParsedEsdmModel,
  SystemOverride,
} from './types.js';
import { kindBadgeFields } from './badges.js';
import { filterContextMappingsForDomain, filterDomainScoped, getBoundedContextKey, groupBoundedContexts } from './parser.js';

const toTitle = (value: string) =>
  value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

type EsdmUbiquitousLanguageEntry = NonNullable<EsdmBoundedContext['ubiquitousLanguage']>[number];

const slugifyTerm = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');

const formatUbiquitousLanguageDescription = (entry: EsdmUbiquitousLanguageEntry) => {
  const lines = [entry.definition.trim()];

  if (entry.avoid?.length) {
    const avoidLines = entry.avoid.map(
      (item) => `- **${item.term}**${item.reason ? ` — ${item.reason}` : ''}`
    );
    lines.push('', '**Avoid:**', ...avoidLines);
  }

  return lines.join('\n');
};

export const mapDomainUbiquitousLanguage = (
  contexts: Iterable<BoundedContextContext>
): MappedUbiquitousLanguageTerm[] => {
  const collected: Array<{ boundedContext: string; entry: EsdmUbiquitousLanguageEntry }> = [];

  for (const context of contexts) {
    for (const entry of context.boundedContext.ubiquitousLanguage ?? []) {
      collected.push({ boundedContext: context.boundedContext.name, entry });
    }
  }

  const termCounts = new Map<string, number>();
  for (const { entry } of collected) {
    const key = entry.term.toLowerCase();
    termCounts.set(key, (termCounts.get(key) ?? 0) + 1);
  }

  return collected.map(({ boundedContext, entry }) => {
    const duplicated = (termCounts.get(entry.term.toLowerCase()) ?? 0) > 1;
    const name = duplicated ? `${entry.term} (${toTitle(boundedContext)})` : entry.term;
    const id = slugifyTerm(duplicated ? `${entry.term} ${boundedContext}` : entry.term);
    const description = formatUbiquitousLanguageDescription(entry);

    return {
      id,
      name,
      summary: entry.definition.trim(),
      ...(description !== entry.definition.trim() ? { description } : {}),
    };
  });
};

const renderRules = (title: string, rules?: Array<{ name: string; rule?: string; condition?: string }>) => {
  if (!rules || rules.length === 0) {
    return '';
  }

  const lines = rules.map((rule) => `- **${rule.name}**: ${rule.rule ?? rule.condition ?? ''}`);
  return `\n\n## ${title}\n\n${lines.join('\n')}\n`;
};

/** Escape `{`/`}` in MDX prose so path templates like `/tenants/{tenantId}` render literally. */
export const escapeMdxLiterals = (markdown: string) =>
  markdown
    .split(/(```[\s\S]*?```|`[^`]+`)/g)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(/\{/g, '\\{').replace(/\}/g, '\\}')))
    .join('');

/** EventCatalog renders name and summary from frontmatter — body markdown must not repeat them. */
const bodyMarkdown = (...parts: Array<string | undefined | null | false>) =>
  escapeMdxLiterals(parts.filter(Boolean).join(''));

const isExternalEndpoint = (endpoint: EsdmMappingEndpoint): endpoint is { domain: string; externalSystem: string } =>
  'externalSystem' in endpoint;

const contextMappingLabel = (type: EsdmContextMapping['type']) => {
  switch (type) {
    case 'customer-supplier':
      return 'depends on';
    case 'conformist':
      return 'conforms to';
    case 'anti-corruption-layer':
      return 'translates via anti-corruption layer';
    case 'open-host-service':
      return 'publishes API to';
    case 'published-language':
      return 'publishes language to';
    case 'shared-kernel':
      return 'shares kernel with';
    case 'partnership':
      return 'partners in';
    case 'separate-ways':
      return 'separate ways from';
    default:
      return type;
  }
};

export const mapMessageId = (name: string) => name;

export const mapCommandMessage = (
  command: BoundedContextContext['commands'][number],
  version: string
): MappedMessage => {
  const aggregateName = 'aggregate' in command.scope ? command.scope.aggregate : undefined;
  const dcbName =
    'dynamicConsistencyBoundary' in command.scope ? command.scope.dynamicConsistencyBoundary : undefined;

  return {
    id: mapMessageId(command.name),
    name: toTitle(command.name),
    version,
    type: 'command',
    summary: command.description,
    description: command.description,
    markdown: bodyMarkdown(
      aggregateName ? `\n**Aggregate:** \`${aggregateName}\`\n` : '',
      dcbName ? `\n**Dynamic consistency boundary:** \`${dcbName}\`\n` : '',
      command.publishes?.length ? `\n**Publishes:** ${command.publishes.map((event) => `\`${event}\``).join(', ')}\n` : '',
      renderRules('Constraints', command.constraints)
    ),
    schema: command.data,
    ...kindBadgeFields('command', command.metadata?.labels),
  };
};

export const mapEventMessage = (event: BoundedContextContext['events'][number], version: string): MappedMessage => {
  const aggregateName = 'aggregate' in event.scope ? event.scope.aggregate : undefined;
  const cloudEventType = event.metadata?.annotations?.['cloudevents.type'];

  return {
    id: mapMessageId(event.name),
    name: toTitle(event.name),
    version,
    type: 'event',
    summary: event.description,
    description: event.description,
    markdown: bodyMarkdown(
      aggregateName ? `\n**Aggregate:** \`${aggregateName}\`\n` : '',
      cloudEventType ? `\n**CloudEvents type:** \`${cloudEventType}\`\n` : ''
    ),
    schema: event.data,
    ...kindBadgeFields('event', event.metadata?.labels),
  };
};

export const mapQueryMessage = (query: BoundedContextContext['queries'][number], version: string): MappedMessage => {
  return {
    id: mapMessageId(query.name),
    name: toTitle(query.name),
    version,
    type: 'query',
    summary: query.description,
    description: query.description,
    markdown: bodyMarkdown(
      `\n**Read model:** \`${query.readModel}\`\n`,
      renderRules('Constraints', query.constraints)
    ),
    schema: query.result,
    ...kindBadgeFields('query', query.metadata?.labels),
  };
};

const messageRef = (id: string, version: string) => ({ id, version });

const dedupeMessageRefs = (refs: Array<{ id: string; version: string }>) =>
  Array.from(new Map(refs.map((ref) => [ref.id, ref])).values());

const externalCallCommandId = (handlerName: string, externalSystem: string, index: number) =>
  index === 0 ? `${handlerName}-invoke-${externalSystem}` : `${handlerName}-invoke-${externalSystem}-${index + 1}`;

const mapExternalCallCommand = (
  eventHandler: EsdmEventHandler,
  effect: { type: 'external-call'; externalSystem: string; rule: string },
  index: number,
  version: string
): MappedMessage => {
  const id = externalCallCommandId(eventHandler.name, effect.externalSystem, index);
  const summary = effect.rule.trim().split('\n')[0];

  return {
    id,
    name: toTitle(`${eventHandler.name} → ${effect.externalSystem}`),
    version,
    type: 'command',
    summary,
    description: summary,
    markdown: bodyMarkdown(
      `\nIntegration command generated from ESDM event handler \`${eventHandler.name}\` external call to \`${effect.externalSystem}\`.\n`,
      `\n${effect.rule.trim()}\n`
    ),
    ...kindBadgeFields('command'),
  };
};

const findProcessManagerEmittedEvents = (
  processManager: EsdmProcessManager,
  domainName: string,
  events: EsdmEvent[]
): EsdmEvent[] => {
  const prose = [
    processManager.description ?? '',
    ...processManager.reactions.map((reaction) => reaction.rule),
  ].join('\n');

  if (!/\b[Ee]mit(s|ted|ting)?\b/.test(prose)) {
    return [];
  }

  return events.filter(
    (event) =>
      event.scope.domain === domainName &&
      !('aggregate' in event.scope) &&
      prose.includes(event.name)
  );
};

const findSystemOverride = (overrides: SystemOverride[] | undefined, boundedContextName: string) =>
  overrides?.find((override) => override.boundedContext === boundedContextName);

const findUnitOverride = (overrides: ConsistencyUnitOverride[] | undefined, boundedContextName: string, unit: string) =>
  overrides?.find((override) => override.boundedContext === boundedContextName && override.unit === unit);

const findIntegrationOverride = (overrides: IntegrationOverride[] | undefined, name: string) =>
  overrides?.find((override) => override.name === name);

const mapActor = (actor: EsdmActor): MappedSystemActor => ({
  id: actor.name,
  name: toTitle(actor.name),
  label: actor.responsibilities?.[0],
  direction: actor.type === 'human' ? 'inbound' : 'inbound',
});

const mapAggregateService = (
  context: BoundedContextContext,
  aggregate: EsdmAggregate,
  version: string,
  unitOverride?: ConsistencyUnitOverride
): MappedService => {
  const serviceId = unitOverride?.id ?? aggregate.name;
  const serviceName = unitOverride?.name ?? toTitle(aggregate.name);

  const commands = context.commands.filter(
    (command) => 'aggregate' in command.scope && command.scope.aggregate === aggregate.name
  );
  const events = context.events.filter((event) => 'aggregate' in event.scope && event.scope.aggregate === aggregate.name);

  const commandMessages = commands.map((command) => mapCommandMessage(command, version));
  const eventMessages = events.map((event) => mapEventMessage(event, version));
  const messages = [...commandMessages, ...eventMessages];

  const markdown = bodyMarkdown(
    `\nGenerated from ESDM aggregate \`${aggregate.name}\` in bounded context \`${context.boundedContext.name}\`.\n`,
    renderRules('Invariants', aggregate.invariants),
    serviceDiagramMarkdown()
  );

  return {
    id: serviceId,
    name: serviceName,
    version,
    summary: aggregate.description,
    markdown,
    schema: aggregate.state,
    sends: eventMessages.map((message) => messageRef(message.id, version)),
    receives: commandMessages.map((message) => messageRef(message.id, version)),
    messages,
    ...kindBadgeFields('aggregate', aggregate.metadata?.labels),
    placement: 'system',
    boundedContext: context.boundedContext.name,
    esdmKind: 'aggregate',
    draft: unitOverride?.draft,
    owners: unitOverride?.owners,
    sourceFiles: [],
  };
};

const mapDcbService = (
  context: BoundedContextContext,
  dcb: EsdmDynamicConsistencyBoundary,
  version: string,
  unitOverride?: ConsistencyUnitOverride
): MappedService => {
  const serviceId = unitOverride?.id ?? dcb.name;
  const serviceName = unitOverride?.name ?? toTitle(dcb.name);

  const commands = context.commands.filter(
    (command) =>
      'dynamicConsistencyBoundary' in command.scope && command.scope.dynamicConsistencyBoundary === dcb.name
  );
  const publishedEventNames = new Set(commands.flatMap((command) => command.publishes));
  const events = context.events.filter(
    (event) => !('aggregate' in event.scope) && publishedEventNames.has(event.name)
  );

  const commandMessages = commands.map((command) => mapCommandMessage(command, version));
  const eventMessages = events.map((event) => mapEventMessage(event, version));
  const messages = [...commandMessages, ...eventMessages];

  const markdown = bodyMarkdown(
    `\nGenerated from ESDM dynamic consistency boundary \`${dcb.name}\` in bounded context \`${context.boundedContext.name}\`.\n`,
    renderRules('Invariants', dcb.invariants),
    serviceDiagramMarkdown()
  );

  return {
    id: serviceId,
    name: serviceName,
    version,
    summary: dcb.description,
    markdown,
    sends: eventMessages.map((message) => messageRef(message.id, version)),
    receives: commandMessages.map((message) => messageRef(message.id, version)),
    messages,
    ...kindBadgeFields('dynamic-consistency-boundary', dcb.metadata?.labels),
    placement: 'system',
    boundedContext: context.boundedContext.name,
    esdmKind: 'dynamic-consistency-boundary',
    draft: unitOverride?.draft,
    owners: unitOverride?.owners,
    sourceFiles: [],
  };
};

const mapReadModelService = (
  context: BoundedContextContext,
  readModel: EsdmReadModel,
  version: string,
  unitOverride?: ConsistencyUnitOverride
): MappedService => {
  const serviceId = unitOverride?.id ?? readModel.name;
  const serviceName = unitOverride?.name ?? toTitle(readModel.name);

  const queries = context.queries.filter((query) => query.readModel === readModel.name);
  const projectedEventNames = new Set((readModel.projections ?? []).map((projection) => projection.event));
  const events = context.events.filter((event) => projectedEventNames.has(event.name));

  const queryMessages = queries.map((query) => mapQueryMessage(query, version));
  const eventMessages = events.map((event) => mapEventMessage(event, version));
  const messages = [...queryMessages, ...eventMessages];

  const projectionLines = (readModel.projections ?? []).map(
    (projection) =>
      `- **${projection.event}** (${projection.boundedContext}${projection.aggregate ? `/${projection.aggregate}` : ''}): ${projection.rule}`
  );

  const markdown = bodyMarkdown(
    readModel.paradigm ? `\n**Paradigm:** ${readModel.paradigm}\n` : '',
    `\nGenerated from ESDM read model \`${readModel.name}\` in bounded context \`${context.boundedContext.name}\`.\n`,
    projectionLines.length ? `\n## Projections\n\n${projectionLines.join('\n')}\n` : '',
    serviceDiagramMarkdown()
  );

  return {
    id: serviceId,
    name: serviceName,
    version,
    summary: readModel.description,
    markdown,
    schema: readModel.schema,
    sends: [],
    receives: [...queryMessages, ...eventMessages].map((message) => messageRef(message.id, version)),
    messages,
    ...kindBadgeFields('read-model', readModel.metadata?.labels),
    placement: 'system',
    boundedContext: context.boundedContext.name,
    esdmKind: 'read-model',
    draft: unitOverride?.draft,
    owners: unitOverride?.owners,
    sourceFiles: [],
  };
};

const mapDomainServiceResource = (
  context: BoundedContextContext,
  domainService: EsdmDomainService,
  version: string,
  unitOverride?: ConsistencyUnitOverride
): MappedService => {
  const serviceId = unitOverride?.id ?? domainService.name;
  const serviceName = unitOverride?.name ?? toTitle(domainService.name);

  const functionLines = (domainService.functions ?? []).map(
    (fn) => `- **${fn.name}**${fn.description ? `: ${fn.description}` : ''}${fn.rule ? ` — ${fn.rule}` : ''}`
  );

  const markdown = bodyMarkdown(
    `\nGenerated from ESDM domain service \`${domainService.name}\` in bounded context \`${context.boundedContext.name}\`.\n`,
    functionLines.length ? `\n## Functions\n\n${functionLines.join('\n')}\n` : '',
    serviceDiagramMarkdown()
  );

  return {
    id: serviceId,
    name: serviceName,
    version,
    summary: domainService.description,
    markdown,
    sends: [],
    receives: [],
    messages: [],
    ...kindBadgeFields('domain-service', domainService.metadata?.labels),
    placement: 'system',
    boundedContext: context.boundedContext.name,
    esdmKind: 'domain-service',
    draft: unitOverride?.draft,
    owners: unitOverride?.owners,
    sourceFiles: [],
  };
};

const mapBoundedContextServices = (
  context: BoundedContextContext,
  version: string,
  unitOverrides?: ConsistencyUnitOverride[]
): MappedService[] => {
  const services: MappedService[] = [];

  for (const aggregate of context.aggregates) {
    services.push(
      mapAggregateService(
        context,
        aggregate,
        version,
        findUnitOverride(unitOverrides, context.boundedContext.name, aggregate.name)
      )
    );
  }

  for (const dcb of context.dynamicConsistencyBoundaries) {
    services.push(
      mapDcbService(
        context,
        dcb,
        version,
        findUnitOverride(unitOverrides, context.boundedContext.name, dcb.name)
      )
    );
  }

  for (const readModel of context.readModels) {
    services.push(
      mapReadModelService(
        context,
        readModel,
        version,
        findUnitOverride(unitOverrides, context.boundedContext.name, readModel.name)
      )
    );
  }

  for (const domainService of context.domainServices) {
    services.push(
      mapDomainServiceResource(
        context,
        domainService,
        version,
        findUnitOverride(unitOverrides, context.boundedContext.name, domainService.name)
      )
    );
  }

  return services;
};

const resolveSystemId = (boundedContextName: string, override?: SystemOverride) => override?.id ?? boundedContextName;

const resolveContextMappingRelationship = (
  mapping: EsdmContextMapping,
  version: string
): { sourceBoundedContext: string; relationship?: MappedSystemRelationship; externalNote?: string } | undefined => {
  const label = contextMappingLabel(mapping.type);

  switch (mapping.type) {
    case 'customer-supplier':
      if (!mapping.customer || !mapping.supplier || isExternalEndpoint(mapping.customer) || isExternalEndpoint(mapping.supplier)) {
        return undefined;
      }
      return {
        sourceBoundedContext: mapping.customer.boundedContext,
        relationship: { id: mapping.supplier.boundedContext, version, label },
      };
    case 'conformist':
      if (!mapping.conformist || !mapping.upstream || isExternalEndpoint(mapping.conformist) || isExternalEndpoint(mapping.upstream)) {
        return undefined;
      }
      return {
        sourceBoundedContext: mapping.conformist.boundedContext,
        relationship: { id: mapping.upstream.boundedContext, version, label },
      };
    case 'anti-corruption-layer':
      if (!mapping.downstream || !mapping.upstream || isExternalEndpoint(mapping.downstream)) {
        return undefined;
      }
      if (isExternalEndpoint(mapping.upstream)) {
        return {
          sourceBoundedContext: mapping.downstream.boundedContext,
          externalNote: mapping.upstream.externalSystem,
        };
      }
      return {
        sourceBoundedContext: mapping.downstream.boundedContext,
        relationship: { id: mapping.upstream.boundedContext, version, label },
      };
    case 'open-host-service':
      if (!mapping.host || !mapping.consumer || isExternalEndpoint(mapping.host) || isExternalEndpoint(mapping.consumer)) {
        return undefined;
      }
      return {
        sourceBoundedContext: mapping.host.boundedContext,
        relationship: { id: mapping.consumer.boundedContext, version, label },
      };
    case 'published-language':
      if (!mapping.publisher || !mapping.consumer || isExternalEndpoint(mapping.publisher) || isExternalEndpoint(mapping.consumer)) {
        return undefined;
      }
      return {
        sourceBoundedContext: mapping.publisher.boundedContext,
        relationship: { id: mapping.consumer.boundedContext, version, label },
      };
    case 'shared-kernel':
    case 'partnership':
    case 'separate-ways': {
      const participants = mapping.participants;
      if (!participants || participants.length !== 2) {
        return undefined;
      }
      return {
        sourceBoundedContext: participants[0].boundedContext,
        relationship: { id: participants[1].boundedContext, version, label },
      };
    }
    default:
      return undefined;
  }
};

export const mapBoundedContextSystem = (
  context: BoundedContextContext,
  version: string,
  services: MappedService[],
  relationships: MappedSystemRelationship[],
  systemOverride?: SystemOverride,
  externalNotes?: string[]
): MappedSystem => {
  const systemId = resolveSystemId(context.boundedContext.name, systemOverride);
  const systemName = systemOverride?.name ?? toTitle(context.boundedContext.name);

  const ubLines = (context.boundedContext.ubiquitousLanguage ?? []).map(
    (entry) => `- **${entry.term}**: ${entry.definition.trim()}`
  );

  const markdown = bodyMarkdown(
    `\nGenerated from ESDM bounded context \`${context.boundedContext.name}\` in domain \`${context.domain.name}\`.\n`,
    ubLines.length ? `\n## Ubiquitous Language\n\n${ubLines.join('\n\n')}\n` : '',
    externalNotes?.length ? `\n## External Integrations\n\n${externalNotes.join('\n')}\n` : '',
    systemDiagramMarkdown()
  );

  return {
    id: systemId,
    name: systemName,
    version,
    summary: context.boundedContext.description,
    markdown,
    boundedContext: context.boundedContext.name,
    services: services.map((service) => ({ id: service.id, version: service.version })),
    relationships,
    actors: context.actors.map(mapActor),
    ...kindBadgeFields('bounded-context', context.boundedContext.metadata?.labels),
    draft: systemOverride?.draft,
    owners: systemOverride?.owners,
  };
};

const eventReferenceToMessageId = (reference: EsdmEventReference) => reference.event;
const commandReferenceToMessageId = (reference: EsdmCommandReference) => reference.command;

export const mapPolicyService = (policy: EsdmPolicy, version: string, override?: IntegrationOverride): MappedService => {
  const serviceId = override?.id ?? policy.name;
  const serviceName = override?.displayName ?? toTitle(policy.name);

  const receives = policy.handles.map((reference) => ({
    id: eventReferenceToMessageId(reference),
    version,
  }));
  const sends = policy.emits.map((reference) => ({
    id: commandReferenceToMessageId(reference),
    version,
  }));

  const handleLines = policy.handles.map(
    (reference) =>
      `- \`${reference.event}\` (${reference.boundedContext}${reference.aggregate ? `/${reference.aggregate}` : ''})`
  );
  const emitLines = policy.emits.map(
    (reference) =>
      `- \`${reference.command}\` (${reference.boundedContext}${reference.aggregate ? `/${reference.aggregate}` : ''})`
  );

  const markdown = bodyMarkdown(
    `\nGenerated from ESDM policy \`${policy.name}\`.\n`,
    policy.deliveryGuarantee ? `\n**Delivery guarantee:** ${policy.deliveryGuarantee}\n` : '',
    handleLines.length ? `\n## Handles\n\n${handleLines.join('\n')}\n` : '',
    emitLines.length ? `\n## Emits\n\n${emitLines.join('\n')}\n` : '',
    renderRules('Constraints', policy.constraints),
    serviceDiagramMarkdown()
  );

  return {
    id: serviceId,
    name: serviceName,
    version,
    summary: policy.description,
    markdown,
    sends,
    receives,
    messages: [],
    ...kindBadgeFields('policy', policy.metadata?.labels),
    placement: 'domain',
    esdmKind: 'policy',
    draft: override?.draft,
    owners: override?.owners,
    sourceFiles: [],
  };
};

export const mapEventHandlerService = (
  eventHandler: EsdmEventHandler,
  version: string,
  override?: IntegrationOverride
): { service: MappedService; integrationCommands: MappedMessage[] } => {
  const serviceId = override?.id ?? eventHandler.name;
  const serviceName = override?.displayName ?? toTitle(eventHandler.name);

  const receives = eventHandler.handles.map((reference) => messageRef(eventReferenceToMessageId(reference), version));

  const integrationCommands: MappedMessage[] = [];
  const sends: Array<{ id: string; version: string }> = [];

  eventHandler.sideEffects.forEach((effect, index) => {
    if (effect.type === 'external-call') {
      const command = mapExternalCallCommand(eventHandler, effect, index, version);
      integrationCommands.push(command);
      sends.push(messageRef(command.id, version));
    }
  });

  const sideEffectLines = eventHandler.sideEffects.map((effect) => {
    if (effect.type === 'external-call') {
      return `- **External call** (\`${effect.externalSystem}\`): ${effect.rule}`;
    }
    return `- ${effect.rule}`;
  });

  const markdown = bodyMarkdown(
    `\nGenerated from ESDM event handler \`${eventHandler.name}\`.\n`,
    eventHandler.deliveryGuarantee ? `\n**Delivery guarantee:** ${eventHandler.deliveryGuarantee}\n` : '',
    sideEffectLines.length ? `\n## Side Effects\n\n${sideEffectLines.join('\n')}\n` : '',
    renderRules('Constraints', eventHandler.constraints),
    serviceDiagramMarkdown()
  );

  return {
    service: {
      id: serviceId,
      name: serviceName,
      version,
      summary: eventHandler.description,
      markdown,
      sends,
      receives,
      messages: [],
      ...kindBadgeFields('event-handler', eventHandler.metadata?.labels),
      placement: 'domain',
      esdmKind: 'event-handler',
      draft: override?.draft,
      owners: override?.owners,
      sourceFiles: [],
    },
    integrationCommands,
  };
};

export const mapProcessManagerService = (
  processManager: EsdmProcessManager,
  version: string,
  domainName: string,
  domainEvents: EsdmEvent[],
  override?: IntegrationOverride
): { service: MappedService; flow: MappedFlow } => {
  const serviceId = override?.id ?? processManager.name;
  const serviceName = override?.displayName ?? toTitle(processManager.name);

  const reactionEvents = processManager.reactions
    .map((reaction) => reaction.when)
    .filter((when): when is EsdmEventReference => 'event' in when);
  const handledEvents = [...processManager.startsWhen, ...reactionEvents];

  const receives = dedupeMessageRefs(
    handledEvents.map((reference) => messageRef(eventReferenceToMessageId(reference), version))
  );

  const emittedCommands = processManager.reactions.flatMap((reaction) => reaction.emits ?? []);
  const emittedEvents = findProcessManagerEmittedEvents(processManager, domainName, domainEvents);

  const sends = dedupeMessageRefs([
    ...emittedCommands.map((reference) => messageRef(commandReferenceToMessageId(reference), version)),
    ...emittedEvents.map((event) => messageRef(event.name, version)),
  ]);

  const flowId = `${processManager.name}-flow`;
  const flowSteps = processManager.reactions.map((reaction, index) => {
    const stepId = `reaction-${index + 1}`;
    const whenLabel =
      'event' in reaction.when
        ? reaction.when.event
        : 'timer' in reaction.when
          ? `timer:${reaction.when.timer}`
          : 'trigger';

    return {
      id: stepId,
      title: whenLabel,
      summary: reaction.rule,
      ...(index < processManager.reactions.length - 1 ? { next_step: `reaction-${index + 2}` } : {}),
    };
  });

  const flow: MappedFlow = {
    id: flowId,
    name: `${serviceName} Flow`,
    version,
    summary: processManager.description,
    markdown: bodyMarkdown(
      `\nGenerated from ESDM process manager \`${processManager.name}\`.\n`,
      renderRules('Invariants', processManager.invariants),
      renderRules('Constraints', processManager.constraints)
    ),
    steps: flowSteps,
    linkedServiceId: serviceId,
    ...kindBadgeFields('process-manager', processManager.metadata?.labels),
    draft: override?.draft,
    owners: override?.owners,
  };

  const service: MappedService = {
    id: serviceId,
    name: serviceName,
    version,
    summary: processManager.description,
    markdown: bodyMarkdown(
      `\nGenerated from ESDM process manager \`${processManager.name}\`.\n`,
      renderRules('Invariants', processManager.invariants),
      renderRules('Constraints', processManager.constraints),
      serviceDiagramMarkdown()
    ),
    schema: processManager.state,
    sends,
    receives,
    messages: [],
    ...kindBadgeFields('process-manager', processManager.metadata?.labels),
    flows: [{ id: flowId, version }],
    placement: 'domain',
    esdmKind: 'process-manager',
    draft: override?.draft,
    owners: override?.owners,
    sourceFiles: [],
  };

  return { service, flow };
};

export const mapExternalSystemService = (
  externalSystem: EsdmExternalSystem,
  version: string,
  receives: Array<{ id: string; version: string }>,
  override?: IntegrationOverride
): MappedService => {
  const serviceId = override?.id ?? externalSystem.name;
  const serviceName = override?.displayName ?? toTitle(externalSystem.name);

  const capabilityLines = (externalSystem.capabilities ?? []).map((capability) => `- ${capability}`);

  const markdown = bodyMarkdown(
    `\nGenerated from ESDM external system \`${externalSystem.name}\`.\n`,
    externalSystem.direction ? `\n**Direction:** ${externalSystem.direction}\n` : '',
    externalSystem.category ? `\n**Category:** ${externalSystem.category}\n` : '',
    capabilityLines.length ? `\n## Capabilities\n\n${capabilityLines.join('\n')}\n` : '',
    serviceDiagramMarkdown()
  );

  return {
    id: serviceId,
    name: serviceName,
    version,
    summary: externalSystem.description,
    markdown,
    sends: [],
    receives,
    messages: [],
    ...kindBadgeFields('external-system', externalSystem.metadata?.labels),
    externalSystem: true,
    placement: 'domain',
    esdmKind: 'external-system',
    draft: override?.draft,
    owners: override?.owners,
    sourceFiles: [],
  };
};

const serviceDiagramMarkdown = () =>
  bodyMarkdown(
    `\n## Message Flow Map\n\nMessages this service sends and receives, and how they connect in the catalog.\n\n<NodeGraph />\n`
  );

const systemDiagramMarkdown = () =>
  bodyMarkdown(
    `\n## Resource Diagram\n\nThe services and messages that make up this system.\n\n<NodeGraph />\n`
  );

const domainDiagramMarkdown = () =>
  bodyMarkdown(
    `\n## System Diagram\n\nThe systems in this domain, how they relate, and the people who interact with them.\n\n<ContextDiagram />\n`,
    `\n## Resource Diagram\n\nThe components that make up this domain.\n\n<NodeGraph />\n`
  );

export const mapDomain = (
  domainConfig: DomainConfig,
  systems: Array<{ id: string; version: string }>,
  domainServices: Array<{ id: string; version: string }>,
  esdmDomain: EsdmDomain
): MappedDomain => {
  return {
    id: domainConfig.id,
    name: domainConfig.name,
    version: domainConfig.version,
    summary: esdmDomain.description ?? domainConfig.name,
    markdown: bodyMarkdown(
      domainDiagramMarkdown(),
      `\nGenerated from ESDM domain \`${esdmDomain.name}\`.\n`
    ),
    draft: domainConfig.draft,
    owners: domainConfig.owners,
    systems,
    services: domainServices,
    ...kindBadgeFields('domain', esdmDomain.metadata?.labels),
  };
};

export const mapEsdmModel = (
  model: ParsedEsdmModel,
  domainConfig: DomainConfig,
  options?: {
    systemOverrides?: SystemOverride[];
    unitOverrides?: ConsistencyUnitOverride[];
    integrationOverrides?: IntegrationOverride[];
    defaultVersion?: string;
  }
): MappedModel => {
  const esdmDomain = model.domains.find((domain) => domain.name === domainConfig.id) ?? model.domains[0];
  if (!esdmDomain) {
    throw new Error(`ESDM domain matching "${domainConfig.id}" was not found`);
  }

  const version = options?.defaultVersion ?? domainConfig.version;
  const systemOverrides = options?.systemOverrides ?? [];
  const contexts = groupBoundedContexts(model, esdmDomain);

  const contextMappings = filterContextMappingsForDomain(model.contextMappings, esdmDomain.name);
  const relationshipsByBc = new Map<string, MappedSystemRelationship[]>();
  const externalMappingNotes = new Map<string, string[]>();

  for (const mapping of contextMappings) {
    const resolved = resolveContextMappingRelationship(mapping, version);
    if (!resolved) {
      continue;
    }

    if (resolved.relationship) {
      const existing = relationshipsByBc.get(resolved.sourceBoundedContext) ?? [];
      existing.push(resolved.relationship);
      relationshipsByBc.set(resolved.sourceBoundedContext, existing);
    }

    if (resolved.externalNote) {
      const notes = externalMappingNotes.get(resolved.sourceBoundedContext) ?? [];
      notes.push(
        `- **${mapping.name}** (${mapping.type}): integrates with external system \`${resolved.externalNote}\`${mapping.description ? ` — ${mapping.description.trim()}` : ''}`
      );
      externalMappingNotes.set(resolved.sourceBoundedContext, notes);
    }
  }

  const systems: MappedSystem[] = [];
  const systemServices: MappedService[] = [];

  for (const context of contexts.values()) {
    const systemOverride = findSystemOverride(systemOverrides, context.boundedContext.name);
    const services = mapBoundedContextServices(context, version, options?.unitOverrides);
    const relationships = relationshipsByBc.get(context.boundedContext.name) ?? [];
    const externalNotes = externalMappingNotes.get(context.boundedContext.name);

    systems.push(
      mapBoundedContextSystem(
        context,
        version,
        services,
        relationships,
        systemOverride,
        externalNotes
      )
    );
    systemServices.push(...services);
  }

  const integrationServices: MappedService[] = [];
  const flows: MappedFlow[] = [];
  const integrationMessages: MappedMessage[] = [];
  const externalReceives = new Map<string, Array<{ id: string; version: string }>>();

  for (const policy of filterDomainScoped(model.policies, esdmDomain.name)) {
    integrationServices.push(
      mapPolicyService(policy, version, findIntegrationOverride(options?.integrationOverrides, policy.name))
    );
  }

  for (const eventHandler of filterDomainScoped(model.eventHandlers, esdmDomain.name)) {
    const mapped = mapEventHandlerService(
      eventHandler,
      version,
      findIntegrationOverride(options?.integrationOverrides, eventHandler.name)
    );
    integrationServices.push(mapped.service);
    integrationMessages.push(...mapped.integrationCommands);

    let externalCallIndex = 0;
    for (const effect of eventHandler.sideEffects) {
      if (effect.type !== 'external-call') {
        continue;
      }

      const commandId = externalCallCommandId(eventHandler.name, effect.externalSystem, externalCallIndex);
      externalCallIndex += 1;
      const existing = externalReceives.get(effect.externalSystem) ?? [];
      existing.push(messageRef(commandId, version));
      externalReceives.set(effect.externalSystem, existing);
    }
  }

  for (const processManager of filterDomainScoped(model.processManagers, esdmDomain.name)) {
    const mapped = mapProcessManagerService(
      processManager,
      version,
      esdmDomain.name,
      model.events,
      findIntegrationOverride(options?.integrationOverrides, processManager.name)
    );
    integrationServices.push(mapped.service);
    flows.push(mapped.flow);
  }

  for (const externalSystem of filterDomainScoped(model.externalSystems, esdmDomain.name)) {
    integrationServices.push(
      mapExternalSystemService(
        externalSystem,
        version,
        dedupeMessageRefs(externalReceives.get(externalSystem.name) ?? []),
        findIntegrationOverride(options?.integrationOverrides, externalSystem.name)
      )
    );
  }

  const domain = mapDomain(
    domainConfig,
    systems.map((system) => ({ id: system.id, version: system.version })),
    integrationServices.map((service) => ({ id: service.id, version: service.version })),
    esdmDomain
  );

  const messageMap = new Map<string, MappedMessage>();
  for (const service of systemServices) {
    for (const message of service.messages) {
      messageMap.set(message.id, message);
    }
  }
  for (const message of integrationMessages) {
    messageMap.set(message.id, message);
  }

  return {
    esdmDomain,
    domain,
    ubiquitousLanguage: mapDomainUbiquitousLanguage(contexts.values()),
    systems,
    services: [...systemServices, ...integrationServices],
    flows,
    messages: Array.from(messageMap.values()),
  };
};
