import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import argv from 'minimist';
import path from 'node:path';
import { z } from 'zod';
import { findServiceOverride, mapBoundedContextService, mapDomain } from './mapper.js';
import { groupBoundedContexts, loadEsdmDocuments, parseEsdmModel, resolveDomain } from './parser.js';
import type { GeneratorOptions, MappedMessage } from './types.js';

type CatalogSdk = ReturnType<typeof utils>;

const cliArgs = argv(process.argv.slice(2));

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
  services: z
    .array(
      z.object({
        boundedContext: z.string(),
        id: z.string().optional(),
        name: z.string().optional(),
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
  let markdown = message.markdown;

  if (existing) {
    if (existing.version !== message.version) {
      await operation.version(message.id);
    }

    if (existing.version === message.version) {
      markdown = existing.markdown;
    }
  }

  await operation.write(
    {
      id: message.id,
      name: message.name,
      version: message.version,
      markdown,
      ...(message.summary ? { summary: message.summary } : {}),
      ...(message.draft ? { draft: true } : {}),
    },
    { override: true }
  );

  if (message.schema) {
    await operation.addSchema(
      message.id,
      {
        fileName: `${message.id}.json`,
        schema: JSON.stringify(message.schema, null, 2),
      },
      message.version
    );
  }
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
    writeService,
    writeDomain,
    addServiceToDomain,
    getDomain,
    versionDomain,
    getService,
    versionService,
    getResourcePath,
    addFileToService,
  } = sdk;

  console.log(chalk.green(`Processing ${validatedOptions.models.length} ESDM model(s)...`));

  for (const modelConfig of validatedOptions.models) {
    console.log(chalk.gray(`Processing ${modelConfig.path}`));

    const model = await parseEsdmModel(modelConfig.path, modelConfig.headers);
    const esdmDomain = resolveDomain(model, validatedOptions.domain?.id);
    const boundedContexts = groupBoundedContexts(model, esdmDomain);
    const defaultVersion = modelConfig.version ?? validatedOptions.domain?.version ?? '0.0.1';

    if (debug) {
      console.log(
        chalk.gray(
          ` - Found domain "${esdmDomain.name}" with ${boundedContexts.size} bounded context(s), ${model.commands.length} command(s), ${model.events.length} event(s), ${model.queries.length} query(ies)`
        )
      );
    }

    const mappedServices = Array.from(boundedContexts.values()).map((context) => {
      const override = findServiceOverride(validatedOptions.services, context.boundedContext.name);
      const version = override?.version ?? defaultVersion;
      return mapBoundedContextService(context, version, override);
    });

    if (validatedOptions.domain) {
      const { id: domainId, name: domainName, version: domainVersion, owners: domainOwners } = validatedOptions.domain;
      const currentDomain = await getDomain(domainId, 'latest');
      const domain = await getDomain(domainId, domainVersion);

      console.log(chalk.blue(`\nProcessing domain: ${domainName} (v${domainVersion})`));

      if (currentDomain && currentDomain.version !== domainVersion) {
        await versionDomain(domainId);
        console.log(chalk.cyan(` - Versioned previous domain (v${currentDomain.version})`));
      }

      if (!domain || domain.version !== domainVersion) {
        const mappedDomain = mapDomain(
          validatedOptions.domain,
          mappedServices.map((service) => ({ id: service.id, version: service.version })),
          esdmDomain.name,
          esdmDomain.description
        );

        await writeDomain({
          id: mappedDomain.id,
          name: mappedDomain.name,
          version: mappedDomain.version,
          markdown: mappedDomain.markdown,
          ...(domainOwners && { owners: domainOwners }),
          ...(mappedDomain.draft && { draft: true }),
        });

        console.log(chalk.cyan(` - Domain (v${domainVersion}) created`));
      } else {
        console.log(chalk.yellow(` - Domain (v${domainVersion}) already exists, skipped creation...`));
      }

      for (const service of mappedServices) {
        await addServiceToDomain(domainId, { id: service.id, version: service.version }, domainVersion);
      }
    }

    for (const service of mappedServices) {
      console.log(chalk.blue(`\nProcessing service: ${service.name} (v${service.version})`));

      let servicePath = path.join('../', 'services', service.id);
      if (validatedOptions.domain) {
        const domainResource = await getResourcePath(
          process.env.PROJECT_DIR as string,
          validatedOptions.domain.id,
          validatedOptions.domain.version
        );

        servicePath = domainResource
          ? path.join('../', domainResource.directory, 'services', service.id)
          : path.join('../', 'domains', validatedOptions.domain.id, 'services', service.id);
      }

      const latestService = await getService(service.id, 'latest');
      let serviceMarkdown = service.markdown;
      let sends = service.sends;
      let receives = service.receives;

      if (latestService) {
        if (latestService.version !== service.version) {
          await versionService(service.id);
          console.log(chalk.cyan(` - Versioned previous service (v${latestService.version})`));
        }

        if (latestService.version === service.version) {
          serviceMarkdown = latestService.markdown;
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

      await writeService(
        {
          id: service.id,
          name: service.name,
          version: service.version,
          markdown: serviceMarkdown,
          sends,
          receives,
          ...(service.summary ? { summary: service.summary } : {}),
          ...(service.owners && { owners: service.owners }),
          ...(modelConfig.owners && !service.owners && { owners: modelConfig.owners }),
          ...(service.draft && { draft: true }),
          ...(modelConfig.draft && { draft: true }),
        },
        {
          path: servicePath,
          override: true,
        }
      );

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
      }

      for (const message of service.messages) {
        await writeMessage(sdk, message);
        console.log(chalk.cyan(` - Message ${message.id} (${message.type}, v${message.version}) created`));
      }

      console.log(chalk.cyan(` - Service (v${service.version}) created`));
      console.log(chalk.green(`\nFinished generating EventCatalog for ESDM service ${service.id} (v${service.version})`));
    }
  }
}
