import type {
  BoundedContextContext,
  DomainConfig,
  MappedDomain,
  MappedMessage,
  MappedService,
  ServiceOverride,
} from './types.js';

const toTitle = (value: string) =>
  value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const renderSchemaSection = (schema?: Record<string, unknown>) => {
  if (!schema || Object.keys(schema).length === 0) {
    return '';
  }

  return `\n\n## Schema\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n`;
};

const renderRules = (title: string, rules?: Array<{ name: string; rule?: string; condition?: string }>) => {
  if (!rules || rules.length === 0) {
    return '';
  }

  const lines = rules.map((rule) => `- **${rule.name}**: ${rule.rule ?? rule.condition ?? ''}`);
  return `\n\n## ${title}\n\n${lines.join('\n')}\n`;
};

export const mapMessageId = (name: string) => name;

export const mapCommandMessage = (context: BoundedContextContext, command: BoundedContextContext['commands'][number], version: string): MappedMessage => {
  const aggregateName = 'aggregate' in command.scope ? command.scope.aggregate : undefined;

  return {
    id: mapMessageId(command.name),
    name: toTitle(command.name),
    version,
    type: 'command',
    summary: command.description,
    description: command.description,
    markdown: [
      `# ${toTitle(command.name)}`,
      command.description ? `\n${command.description}\n` : '',
      aggregateName ? `\n**Aggregate:** \`${aggregateName}\`\n` : '',
      command.publishes?.length ? `\n**Publishes:** ${command.publishes.map((event) => `\`${event}\``).join(', ')}\n` : '',
      renderRules('Constraints', command.constraints),
      renderSchemaSection(command.data),
    ].join(''),
    schema: command.data,
  };
};

export const mapEventMessage = (context: BoundedContextContext, event: BoundedContextContext['events'][number], version: string): MappedMessage => {
  const aggregateName = 'aggregate' in event.scope ? event.scope.aggregate : undefined;
  const cloudEventType = event.metadata?.annotations?.['cloudevents.type'];

  return {
    id: mapMessageId(event.name),
    name: toTitle(event.name),
    version,
    type: 'event',
    summary: event.description,
    description: event.description,
    markdown: [
      `# ${toTitle(event.name)}`,
      event.description ? `\n${event.description}\n` : '',
      aggregateName ? `\n**Aggregate:** \`${aggregateName}\`\n` : '',
      cloudEventType ? `\n**CloudEvents type:** \`${cloudEventType}\`\n` : '',
      renderSchemaSection(event.data),
    ].join(''),
    schema: event.data,
  };
};

export const mapQueryMessage = (context: BoundedContextContext, query: BoundedContextContext['queries'][number], version: string): MappedMessage => {
  return {
    id: mapMessageId(query.name),
    name: toTitle(query.name),
    version,
    type: 'query',
    summary: query.description,
    description: query.description,
    markdown: [
      `# ${toTitle(query.name)}`,
      query.description ? `\n${query.description}\n` : '',
      `\n**Read model:** \`${query.readModel}\`\n`,
      renderSchemaSection(query.result),
    ].join(''),
    schema: query.result,
  };
};

export const mapBoundedContextService = (
  context: BoundedContextContext,
  version: string,
  override?: ServiceOverride
): MappedService => {
  const serviceId = override?.id ?? context.boundedContext.name;
  const serviceName = override?.name ?? toTitle(context.boundedContext.name);

  const commands = context.commands.map((command) => mapCommandMessage(context, command, version));
  const events = context.events.map((event) => mapEventMessage(context, event, version));
  const queries = context.queries.map((query) => mapQueryMessage(context, query, version));
  const messages = [...commands, ...events, ...queries];

  const sends = commands.map((command) => ({ id: command.id, version }));
  const receives = [...events, ...queries].map((message) => ({ id: message.id, version }));

  const aggregateLines = context.aggregates.map((aggregate) => {
    const invariantCount = aggregate.invariants?.length ?? 0;
    return `- **${aggregate.name}**${invariantCount ? ` (${invariantCount} invariant${invariantCount === 1 ? '' : 's'})` : ''}`;
  });

  const readModelLines = context.readModels.map((readModel) => `- **${readModel.name}**${readModel.paradigm ? ` (${readModel.paradigm})` : ''}`);

  const markdown = [
    `# ${serviceName}`,
    context.boundedContext.description ? `\n${context.boundedContext.description}\n` : '',
    `\nGenerated from ESDM bounded context \`${context.boundedContext.name}\` in domain \`${context.domain.name}\`.\n`,
    aggregateLines.length ? `\n## Aggregates\n\n${aggregateLines.join('\n')}\n` : '',
    readModelLines.length ? `\n## Read Models\n\n${readModelLines.join('\n')}\n` : '',
  ].join('');

  return {
    id: serviceId,
    name: serviceName,
    version,
    summary: context.boundedContext.description,
    markdown,
    sends,
    receives,
    messages,
    draft: override?.draft,
    owners: override?.owners,
    sourceFiles: [],
  };
};

export const mapDomain = (
  domainConfig: DomainConfig,
  services: Array<{ id: string; version: string }>,
  esdmDomainName: string,
  esdmDomainDescription?: string
): MappedDomain => {
  return {
    id: domainConfig.id,
    name: domainConfig.name,
    version: domainConfig.version,
    markdown: [
      `# ${domainConfig.name}`,
      esdmDomainDescription ? `\n${esdmDomainDescription}\n` : '',
      `\nGenerated from ESDM domain \`${esdmDomainName}\`.\n`,
    ].join(''),
    draft: domainConfig.draft,
    owners: domainConfig.owners,
    services,
  };
};

export const findServiceOverride = (overrides: ServiceOverride[] | undefined, boundedContextName: string) =>
  overrides?.find((override) => override.boundedContext === boundedContextName);
