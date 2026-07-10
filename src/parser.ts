import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import yaml from 'js-yaml';
import type {
  EsdmAggregate,
  EsdmBoundedContext,
  EsdmCommand,
  EsdmDocument,
  EsdmDomain,
  EsdmEvent,
  EsdmExternalSystem,
  EsdmQuery,
  EsdmReadModel,
  EsdmSubdomain,
  ParsedEsdmModel,
} from './types.js';

const ESDM_FILE_PATTERN = '**/*.{esdm.yaml,esdm.yml}';

const isUrl = (value: string) => /^https?:\/\//i.test(value);

export const resolveModelPath = async (modelPath: string): Promise<string> => {
  if (isUrl(modelPath)) {
    return modelPath;
  }

  const candidates = [
    path.resolve(modelPath),
    ...(process.env.PROJECT_DIR ? [path.resolve(process.env.PROJECT_DIR, modelPath)] : []),
  ];

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return path.resolve(modelPath);
};

const parseYamlDocuments = (content: string, sourceLabel: string): EsdmDocument[] => {
  const documents: EsdmDocument[] = [];

  for (const doc of yaml.loadAll(content) as Array<EsdmDocument | null | undefined>) {
    if (!doc || typeof doc !== 'object') {
      continue;
    }

    if (!doc.apiVersion || !doc.kind || !doc.name) {
      throw new Error(`Invalid ESDM document in ${sourceLabel}: missing apiVersion, kind, or name`);
    }

    documents.push(doc);
  }

  return documents;
};

const readLocalFile = async (filePath: string): Promise<string> => {
  return readFile(filePath, 'utf8');
};

const fetchRemoteFile = async (url: string, headers?: Record<string, string>): Promise<string> => {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ESDM model from ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const collectLocalDocuments = async (modelPath: string): Promise<Array<{ filePath: string; content: string }>> => {
  const resolvedPath = await resolveModelPath(modelPath);
  const stats = await stat(resolvedPath);

  if (stats.isFile()) {
    return [{ filePath: resolvedPath, content: await readLocalFile(resolvedPath) }];
  }

  if (!stats.isDirectory()) {
    throw new Error(`ESDM model path is not a file or directory: ${modelPath}`);
  }

  const files = await glob(ESDM_FILE_PATTERN, {
    cwd: resolvedPath,
    absolute: true,
    nodir: true,
  });

  if (files.length === 0) {
    throw new Error(`No .esdm.yaml files found in ${modelPath}`);
  }

  return Promise.all(
    files.sort().map(async (filePath) => ({
      filePath,
      content: await readLocalFile(filePath),
    }))
  );
};

const collectRemoteDocuments = async (
  url: string,
  headers?: Record<string, string>
): Promise<Array<{ filePath: string; content: string }>> => {
  return [{ filePath: url, content: await fetchRemoteFile(url, headers) }];
};

export const loadEsdmDocuments = async (
  modelPath: string,
  headers?: Record<string, string>
): Promise<Array<{ filePath: string; content: string }>> => {
  if (isUrl(modelPath)) {
    return collectRemoteDocuments(modelPath, headers);
  }

  return collectLocalDocuments(modelPath);
};

const indexDocuments = (documents: EsdmDocument[]): Omit<ParsedEsdmModel, 'sourcePath' | 'documents'> => {
  const domains: EsdmDomain[] = [];
  const subdomains: EsdmSubdomain[] = [];
  const boundedContexts: EsdmBoundedContext[] = [];
  const aggregates: EsdmAggregate[] = [];
  const commands: EsdmCommand[] = [];
  const events: EsdmEvent[] = [];
  const queries: EsdmQuery[] = [];
  const readModels: EsdmReadModel[] = [];
  const externalSystems: EsdmExternalSystem[] = [];

  for (const document of documents) {
    switch (document.kind) {
      case 'domain':
        domains.push(document as EsdmDomain);
        break;
      case 'subdomain':
        subdomains.push(document as EsdmSubdomain);
        break;
      case 'bounded-context':
        boundedContexts.push(document as EsdmBoundedContext);
        break;
      case 'aggregate':
        aggregates.push(document as EsdmAggregate);
        break;
      case 'command':
        commands.push(document as EsdmCommand);
        break;
      case 'event':
        events.push(document as EsdmEvent);
        break;
      case 'query':
        queries.push(document as EsdmQuery);
        break;
      case 'read-model':
        readModels.push(document as EsdmReadModel);
        break;
      case 'external-system':
        externalSystems.push(document as EsdmExternalSystem);
        break;
      default:
        break;
    }
  }

  return {
    domains,
    subdomains,
    boundedContexts,
    aggregates,
    commands,
    events,
    queries,
    readModels,
    externalSystems,
  };
};

export const parseEsdmModel = async (
  modelPath: string,
  headers?: Record<string, string>
): Promise<ParsedEsdmModel> => {
  const files = await loadEsdmDocuments(modelPath, headers);
  const documents = files.flatMap(({ filePath, content }) => parseYamlDocuments(content, filePath));

  return {
    sourcePath: modelPath,
    documents,
    ...indexDocuments(documents),
  };
};

export const getBoundedContextKey = (domain: string, boundedContext: string) => `${domain}/${boundedContext}`;

export const resolveDomain = (model: ParsedEsdmModel, domainName?: string): EsdmDomain => {
  if (domainName) {
    const domain = model.domains.find((item) => item.name === domainName);
    if (!domain) {
      throw new Error(`Domain "${domainName}" was not found in ESDM model at ${model.sourcePath}`);
    }
    return domain;
  }

  if (model.domains.length === 1) {
    return model.domains[0];
  }

  if (model.domains.length === 0) {
    throw new Error(`No domain document found in ESDM model at ${model.sourcePath}`);
  }

  throw new Error(
    `Multiple domains found in ESDM model at ${model.sourcePath}. Provide domain.id matching an ESDM domain name.`
  );
};

export const groupBoundedContexts = (
  model: ParsedEsdmModel,
  domain: EsdmDomain
): Map<string, import('./types.js').BoundedContextContext> => {
  const contexts = new Map<string, import('./types.js').BoundedContextContext>();

  for (const boundedContext of model.boundedContexts.filter((item) => item.scope.domain === domain.name)) {
    contexts.set(getBoundedContextKey(domain.name, boundedContext.name), {
      domain,
      boundedContext,
      aggregates: model.aggregates.filter(
        (item) => item.scope.domain === domain.name && item.scope.boundedContext === boundedContext.name
      ),
      commands: model.commands.filter((item) => item.scope.domain === domain.name && item.scope.boundedContext === boundedContext.name),
      events: model.events.filter((item) => item.scope.domain === domain.name && item.scope.boundedContext === boundedContext.name),
      queries: model.queries.filter((item) => item.scope.domain === domain.name && item.scope.boundedContext === boundedContext.name),
      readModels: model.readModels.filter(
        (item) => item.scope.domain === domain.name && item.scope.boundedContext === boundedContext.name
      ),
    });
  }

  return contexts;
};
