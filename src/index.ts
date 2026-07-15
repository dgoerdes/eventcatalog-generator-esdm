import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import argv from 'minimist';
import path from 'node:path';
import { z } from 'zod';
import { mapEsdmModel } from './mapper.js';
import { loadEsdmDocuments, parseEsdmModel, resolveDomain } from './parser.js';
import { buildBadgePayload } from './badges.js';
import { ESDM_SCHEMA_FILE_NAME, type GeneratorOptions, type MappedDomain, type MappedFlow, type MappedMessage, type MappedService, type MappedSystem } from './types.js';

type CatalogSdk = ReturnType<typeof utils>;

const cliArgs = argv(process.argv.slice(2));

const overrideSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
  draft: z.boolean().optional(),
  owners: z.array(z.string()).optional(),
});

const optionsSchema = z.object({
  models: z
    .array(
      z.object({
        path: z.string({ required_error: 'The model path is required' }),
        version: z.string().optional(),
        draft: z.boolean().optional(),
        owners: z.array(z.string()).optional(),
        headers: z.record(z.string()).optional(),
      })
    )
    .min(1, 'Please provide at least one ESDM model'),
  domain: z
    .object({
      id: z.string({ required_error: 'The domain id is required' }),
      name: z.string({ required_error: 'The domain name is required' }),
      version: z.string({ required_error: 'The domain version is required' }),
      draft: z.boolean().optional(),
      owners: z.array(z.string()).optional(),
    })
    .optional(),
  systems: z
    .array(
      z.object({
        boundedContext: z.string(),
        ...overrideSchema.shape,
      })
    )
    .optional(),
  services: z
    .array(
      z.object({
        boundedContext: z.string(),
        ...overrideSchema.shape,
      })
    )
    .optional(),
  units: z
    .array(
      z.object({
        boundedContext: z.string(),
        unit: z.string(),
        ...overrideSchema.shape,
      })
    )
    .optional(),
  integration: z
    .array(
      z.object({
        name: z.string(),
        id: z.string().optional(),
        displayName: z.string().optional(),
        version: z.string().optional(),
        draft: z.boolean().optional(),
        owners: z.array(z.string()).optional(),
      })
    )
    .optional(),
  debug: z.boolean().optional(),
  saveSourceFiles: z.boolean().optional(),
});

const validateOptions = (options: unknown): GeneratorOptions => {
  const result = optionsSchema.safeParse(options);

  if (!result.success) {
    throw new Error(result.error.errors.map((error) => error.message).join('\n'));
  }

  return result.data;
};

const isDebugEnabled = (options: GeneratorOptions) => Boolean(options.debug || cliArgs.debug);

const renderSchemaViewer = () => `\n\n## Schema\n\n<SchemaViewer file="${ESDM_SCHEMA_FILE_NAME}" />\n`;

const writeMessage = async (sdk: CatalogSdk, message: MappedMessage) => {
  const {
    writeEvent,
    writeCommand,
    writeQuery,
    getEvent,
    getCommand,
    getQuery,
    versionEvent,
    versionCommand,
    versionQuery,
    addSchemaToEvent,
    addSchemaToCommand,
    addSchemaToQuery,
  } = sdk;

  const operations = {
    event: {
      write: writeEvent,
      get: getEvent,
      version: versionEvent,
      addSchema: addSchemaToEvent,
    },
    command: {
      write: writeCommand,
      get: getCommand,
      version: versionCommand,
      addSchema: addSchemaToCommand,
    },
    query: {
      write: writeQuery,
      get: getQuery,
      version: versionQuery,
      addSchema: addSchemaToQuery,
    },
  } as const;

  const operation = operations[message.type];
  const existing = await operation.get(message.id, 'latest');

  if (existing && existing.version !== message.version) {
    await operation.version(message.id);
  }

  await operation.write(
    {
      id: message.id,
      name: message.name,
      version: message.version,
      markdown: message.schema ? `${message.markdown}${renderSchemaViewer()}` : message.markdown,
      ...(message.summary ? { summary: message.summary } : {}),
      ...(message.draft ? { draft: true } : {}),
      ...(message.schema ? { schemaPath: ESDM_SCHEMA_FILE_NAME } : {}),
      ...buildBadgePayload(message),
    },
    { override: true }
  );

  if (message.schema) {
    await operation.addSchema(
      message.id,
      {
        fileName: ESDM_SCHEMA_FILE_NAME,
        schema: JSON.stringify(message.schema, null, 2),
      },
      message.version
    );
  }
};

const buildServicePayload = (service: MappedService, serviceMarkdown: string) => ({
  id: service.id,
  name: service.name,
  version: service.version,
  markdown: serviceMarkdown,
  sends: service.sends,
  receives: service.receives,
  ...(service.summary ? { summary: service.summary } : {}),
  ...(service.owners ? { owners: service.owners } : {}),
  ...(service.draft ? { draft: true } : {}),
  ...(service.externalSystem ? { externalSystem: true } : {}),
  ...(service.flows ? { flows: service.flows } : {}),
  ...buildBadgePayload(service),
  ...(service.schema ? { schemaPath: ESDM_SCHEMA_FILE_NAME } : {}),
});

const writeServiceResource = async (
  sdk: CatalogSdk,
  service: MappedService,
  servicePath: string,
  modelConfigOwners?: string[]
) => {
  const { writeService, getService, versionService, addFileToService } = sdk;

  const latestService = await getService(service.id, 'latest');
  let sends = service.sends;
  let receives = service.receives;

  if (latestService) {
    if (latestService.version !== service.version) {
      await versionService(service.id);
      console.log(chalk.cyan(` - Versioned previous service (v${latestService.version})`));
    } else {
      sends = (latestService.sends ?? sends).map((item) => ({
        id: item.id,
        version: item.version ?? service.version,
      }));
      receives = (latestService.receives ?? receives).map((item) => ({
        id: item.id,
        version: item.version ?? service.version,
      }));
    }
  }

  const serviceMarkdown = service.schema ? `${service.markdown}${renderSchemaViewer()}` : service.markdown;

  await writeService(
    buildServicePayload(
      {
        ...service,
        sends,
        receives,
        ...(modelConfigOwners && !service.owners ? { owners: modelConfigOwners } : {}),
      },
      serviceMarkdown
    ),
    {
      path: servicePath,
      override: true,
    }
  );

  if (service.schema) {
    await addFileToService(
      service.id,
      {
        fileName: ESDM_SCHEMA_FILE_NAME,
        content: JSON.stringify(service.schema, null, 2),
      },
      service.version
    );
  }
};

const writeSystemResource = async (
  sdk: CatalogSdk,
  system: MappedSystem,
  systemPath: string
) => {
  const { writeSystem, getSystem, versionSystem } = sdk;

  const latestSystem = await getSystem(system.id, 'latest');

  if (latestSystem && latestSystem.version !== system.version) {
    await versionSystem(system.id);
    console.log(chalk.cyan(` - Versioned previous system (v${latestSystem.version})`));
  }

  await writeSystem(
    {
      id: system.id,
      name: system.name,
      version: system.version,
      markdown: system.markdown,
      services: system.services,
      relationships: system.relationships,
      actors: system.actors,
      ...(system.summary ? { summary: system.summary } : {}),
      ...(system.owners ? { owners: system.owners } : {}),
      ...(system.draft ? { draft: true } : {}),
      ...buildBadgePayload(system),
    },
    {
      path: systemPath,
      override: true,
    }
  );
};

const writeDomainResource = async (sdk: CatalogSdk, domain: MappedDomain, domainPath: string) => {
  const { writeDomain, getDomain, versionDomain } = sdk;

  const latestDomain = await getDomain(domain.id, 'latest');

  if (latestDomain && latestDomain.version !== domain.version) {
    await versionDomain(domain.id);
    console.log(chalk.cyan(` - Versioned previous domain (v${latestDomain.version})`));
  }

  await writeDomain(
    {
      id: domain.id,
      name: domain.name,
      version: domain.version,
      markdown: domain.markdown,
      systems: domain.systems,
      services: domain.services,
      ...(domain.summary ? { summary: domain.summary } : {}),
      ...(domain.owners ? { owners: domain.owners } : {}),
      ...(domain.draft ? { draft: true } : {}),
      ...buildBadgePayload(domain),
    },
    {
      path: domainPath,
      override: true,
    }
  );
};

const writeFlowResource = async (sdk: CatalogSdk, flow: MappedFlow, flowPath: string) => {
  const { writeFlow, getFlow, versionFlow } = sdk;

  const latestFlow = await getFlow(flow.id, 'latest');

  if (latestFlow && latestFlow.version !== flow.version) {
    await versionFlow(flow.id);
  }

  await writeFlow(
    {
      id: flow.id,
      name: flow.name,
      version: flow.version,
      markdown: flow.markdown,
      steps: flow.steps,
      ...(flow.summary ? { summary: flow.summary } : {}),
      ...(flow.owners ? { owners: flow.owners } : {}),
      ...(flow.draft ? { draft: true } : {}),
      ...buildBadgePayload(flow),
    },
    {
      path: flowPath,
      override: true,
    }
  );
};

export default async function generator(_config: unknown, options: GeneratorOptions) {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!process.env.PROJECT_DIR) {
    throw new Error('Please provide catalog path (env variable PROJECT_DIR)');
  }

  const validatedOptions = validateOptions(options);
  const debug = isDebugEnabled(validatedOptions);
  const sdk = utils(process.env.PROJECT_DIR);

  const {
    addSystemToDomain,
    addServiceToDomain,
    addServiceToSystem,
    addUbiquitousLanguageToDomain,
    getDomain,
    versionDomain,
    getResourcePath,
    addFileToService,
  } = sdk;

  console.log(chalk.green(`Processing ${validatedOptions.models.length} ESDM model(s)...`));

  for (const modelConfig of validatedOptions.models) {
    console.log(chalk.gray(`Processing ${modelConfig.path}`));

    const model = await parseEsdmModel(modelConfig.path, modelConfig.headers);
    const esdmDomain = resolveDomain(model, validatedOptions.domain?.id);
    const defaultVersion = modelConfig.version ?? validatedOptions.domain?.version ?? '0.0.1';
    const systemOverrides = validatedOptions.systems ?? validatedOptions.services;

    if (debug) {
      console.log(
        chalk.gray(
          ` - Found domain "${esdmDomain.name}" with ${model.boundedContexts.length} bounded context(s), ${model.aggregates.length} aggregate(s), ${model.dynamicConsistencyBoundaries.length} DCB(s), ${model.readModels.length} read model(s), ${model.policies.length} policy/policies, ${model.eventHandlers.length} event handler(s), ${model.externalSystems.length} external system(s)`
        )
      );
    }

    if (!validatedOptions.domain) {
      throw new Error('domain configuration is required for ESDM generation');
    }

    const mapped = mapEsdmModel(model, validatedOptions.domain, {
      systemOverrides,
      unitOverrides: validatedOptions.units,
      integrationOverrides: validatedOptions.integration,
      defaultVersion,
    });

    const { id: domainId, name: domainName, version: domainVersion } = validatedOptions.domain;
    const currentDomain = await getDomain(domainId, 'latest');

    console.log(chalk.blue(`\nProcessing domain: ${domainName} (v${domainVersion})`));

    if (currentDomain && currentDomain.version !== domainVersion) {
      await versionDomain(domainId);
      console.log(chalk.cyan(` - Versioned previous domain (v${currentDomain.version})`));
    }

    const domainResource = await getResourcePath(process.env.PROJECT_DIR as string, domainId, domainVersion);
    const domainPath = domainResource
      ? path.join('../', domainResource.directory)
      : path.join('../', 'domains', domainId);

    await writeDomainResource(sdk, mapped.domain, domainPath);
    console.log(chalk.cyan(` - Domain (v${domainVersion}) created`));

    if (mapped.ubiquitousLanguage.length > 0) {
      await addUbiquitousLanguageToDomain(
        domainId,
        { dictionary: mapped.ubiquitousLanguage },
        domainVersion
      );
      console.log(
        chalk.cyan(` - Ubiquitous language (${mapped.ubiquitousLanguage.length} term(s)) added`)
      );
    }

    for (const systemRef of mapped.domain.systems) {
      await addSystemToDomain(domainId, systemRef, domainVersion);
    }

    for (const serviceRef of mapped.domain.services) {
      await addServiceToDomain(domainId, serviceRef, domainVersion);
    }

    const domainBasePath = domainPath;

    for (const message of mapped.messages) {
      await writeMessage(sdk, message);
      if (debug) {
        console.log(chalk.cyan(` - Message ${message.id} (${message.type}, v${message.version}) created`));
      }
    }

    for (const system of mapped.systems) {
      console.log(chalk.blue(`\nProcessing system: ${system.name} (v${system.version})`));

      const systemPath = path.join(domainBasePath, 'systems', system.id);
      await writeSystemResource(sdk, system, systemPath);
      console.log(chalk.cyan(` - System (v${system.version}) created`));

      for (const service of mapped.services.filter(
        (item) => item.placement === 'system' && item.boundedContext === system.boundedContext
      )) {
        console.log(chalk.blue(`  Processing service: ${service.name} (v${service.version})`));

        const servicePath = path.join(systemPath, 'services', service.id);
        await writeServiceResource(sdk, service, servicePath, modelConfig.owners);
        await addServiceToSystem(system.id, { id: service.id, version: service.version }, system.version);

        if (validatedOptions.saveSourceFiles !== false) {
          const sourceFiles = await loadEsdmDocuments(modelConfig.path, modelConfig.headers);
          for (const sourceFile of sourceFiles) {
            await addFileToService(
              service.id,
              {
                fileName: path.basename(sourceFile.filePath),
                content: sourceFile.content,
              },
              service.version
            );
          }

          // addFileToService rewrites frontmatter — restore mapped metadata afterward.
          await writeServiceResource(sdk, service, servicePath, modelConfig.owners);
        }

        for (const message of service.messages) {
          if (debug) {
            console.log(chalk.gray(`   - Linked message ${message.id}`));
          }
        }

        console.log(chalk.cyan(`  - Service (v${service.version}) created`));
      }
    }

    for (const service of mapped.services.filter((item) => item.placement === 'domain')) {
      console.log(chalk.blue(`\nProcessing integration service: ${service.name} (v${service.version})`));

      const servicePath = path.join(domainBasePath, 'services', service.id);
      await writeServiceResource(sdk, service, servicePath, modelConfig.owners);
      console.log(chalk.cyan(` - Integration service (v${service.version}) created`));
    }

    for (const flow of mapped.flows) {
      console.log(chalk.blue(`\nProcessing flow: ${flow.name} (v${flow.version})`));

      const flowPath = path.join(domainBasePath, 'flows', flow.id);
      await writeFlowResource(sdk, flow, flowPath);
      console.log(chalk.cyan(` - Flow (v${flow.version}) created`));
    }

    console.log(
      chalk.green(
        `\nFinished generating EventCatalog for ESDM domain ${domainId}: ${mapped.systems.length} system(s), ${mapped.services.length} service(s), ${mapped.messages.length} message(s), ${mapped.flows.length} flow(s)`
      )
    );
  }
}
