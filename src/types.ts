export const ESDM_CORE_API_VERSION = 'schema.esdm.io/core/v1';

export const ESDM_KINDS = [
  'domain',
  'subdomain',
  'bounded-context',
  'context-mapping',
  'aggregate',
  'dynamic-consistency-boundary',
  'command',
  'event',
  'event-handler',
  'policy',
  'process-manager',
  'read-model',
  'query',
  'entity',
  'value-object',
  'domain-service',
  'actor',
  'external-system',
] as const;

export type EsdmKind = (typeof ESDM_KINDS)[number];

export type EsdmName = string;

export interface EsdmMetadata {
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface EsdmScopeDomain {
  domain: EsdmName;
}

export interface EsdmScopeBoundedContext extends EsdmScopeDomain {
  boundedContext: EsdmName;
}

export interface EsdmScopeAggregate extends EsdmScopeBoundedContext {
  aggregate: EsdmName;
}

export interface EsdmScopeDynamicConsistencyBoundary extends EsdmScopeBoundedContext {
  dynamicConsistencyBoundary: EsdmName;
}

export interface EsdmDocumentBase {
  apiVersion: string;
  kind: EsdmKind;
  name: EsdmName;
  description?: string;
  metadata?: EsdmMetadata;
}

export interface EsdmDomain extends EsdmDocumentBase {
  kind: 'domain';
}

export interface EsdmSubdomain extends EsdmDocumentBase {
  kind: 'subdomain';
  scope: EsdmScopeDomain;
  type: 'core' | 'supporting' | 'generic';
  boundedContexts?: EsdmName[];
}

export interface EsdmBoundedContext extends EsdmDocumentBase {
  kind: 'bounded-context';
  scope: EsdmScopeDomain;
}

export interface EsdmAggregate extends EsdmDocumentBase {
  kind: 'aggregate';
  scope: EsdmScopeBoundedContext;
  identifiedBy?: Record<string, unknown>;
  state?: Record<string, unknown>;
  invariants?: Array<{ name: string; rule: string }>;
}

export interface EsdmCommand extends EsdmDocumentBase {
  kind: 'command';
  scope: EsdmScopeAggregate | EsdmScopeDynamicConsistencyBoundary;
  data?: Record<string, unknown>;
  publishes: EsdmName[];
  actors?: EsdmName[];
  constraints?: Array<{ name: string; rule: string }>;
}

export interface EsdmEvent extends EsdmDocumentBase {
  kind: 'event';
  scope: EsdmScopeAggregate | EsdmScopeBoundedContext;
  data?: Record<string, unknown>;
}

export interface EsdmQuery extends EsdmDocumentBase {
  kind: 'query';
  scope: EsdmScopeBoundedContext;
  readModel: EsdmName;
  result?: Record<string, unknown>;
}

export interface EsdmReadModel extends EsdmDocumentBase {
  kind: 'read-model';
  scope: EsdmScopeBoundedContext;
  paradigm?: string;
  schema?: Record<string, unknown>;
  projections?: Array<Record<string, unknown>>;
}

export interface EsdmExternalSystem extends EsdmDocumentBase {
  kind: 'external-system';
  scope: EsdmScopeDomain;
}

export type EsdmDocument =
  | EsdmDomain
  | EsdmSubdomain
  | EsdmBoundedContext
  | EsdmAggregate
  | EsdmCommand
  | EsdmEvent
  | EsdmQuery
  | EsdmReadModel
  | EsdmExternalSystem
  | EsdmDocumentBase;

export interface ParsedEsdmModel {
  sourcePath: string;
  documents: EsdmDocument[];
  domains: EsdmDomain[];
  subdomains: EsdmSubdomain[];
  boundedContexts: EsdmBoundedContext[];
  aggregates: EsdmAggregate[];
  commands: EsdmCommand[];
  events: EsdmEvent[];
  queries: EsdmQuery[];
  readModels: EsdmReadModel[];
  externalSystems: EsdmExternalSystem[];
}

export interface ModelConfig {
  path: string;
  version?: string;
  draft?: boolean;
  owners?: string[];
  headers?: Record<string, string>;
}

export interface DomainConfig {
  id: string;
  name: string;
  version: string;
  draft?: boolean;
  owners?: string[];
}

export interface ServiceOverride {
  boundedContext: string;
  id?: string;
  name?: string;
  version?: string;
  draft?: boolean;
  owners?: string[];
}

export interface GeneratorOptions {
  models: ModelConfig[];
  domain?: DomainConfig;
  services?: ServiceOverride[];
  debug?: boolean;
  saveSourceFiles?: boolean;
}

export interface BoundedContextContext {
  domain: EsdmDomain;
  boundedContext: EsdmBoundedContext;
  aggregates: EsdmAggregate[];
  commands: EsdmCommand[];
  events: EsdmEvent[];
  queries: EsdmQuery[];
  readModels: EsdmReadModel[];
}

export interface MappedMessage {
  id: string;
  name: string;
  version: string;
  type: 'event' | 'command' | 'query';
  summary?: string;
  description?: string;
  markdown: string;
  schema?: Record<string, unknown>;
  draft?: boolean;
}

export interface MappedService {
  id: string;
  name: string;
  version: string;
  summary?: string;
  markdown: string;
  sends: Array<{ id: string; version: string }>;
  receives: Array<{ id: string; version: string }>;
  messages: MappedMessage[];
  draft?: boolean;
  owners?: string[];
  sourceFiles: Array<{ fileName: string; content: string }>;
}

export interface MappedDomain {
  id: string;
  name: string;
  version: string;
  markdown: string;
  draft?: boolean;
  owners?: string[];
  services: Array<{ id: string; version: string }>;
}
