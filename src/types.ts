export const ESDM_SCHEMA_FILE_NAME = 'schema.json';

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
  ubiquitousLanguage?: Array<{ term: string; definition: string; avoid?: Array<{ term: string; reason: string }> }>;
}

export interface EsdmAggregate extends EsdmDocumentBase {
  kind: 'aggregate';
  scope: EsdmScopeBoundedContext;
  identifiedBy?: Record<string, unknown>;
  state?: Record<string, unknown>;
  invariants?: Array<{ name: string; rule: string }>;
}

export interface EsdmDynamicConsistencyBoundary extends EsdmDocumentBase {
  kind: 'dynamic-consistency-boundary';
  scope: EsdmScopeBoundedContext;
  identifiedBy?: Array<Record<string, unknown>>;
  consults?: Array<Record<string, unknown>>;
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
  parameters?: Record<string, unknown>;
  actors?: EsdmName[];
  constraints?: Array<{ name: string; rule: string }>;
}

export interface EsdmReadModel extends EsdmDocumentBase {
  kind: 'read-model';
  scope: EsdmScopeBoundedContext;
  paradigm?: string;
  schema?: Record<string, unknown>;
  projections?: Array<{
    boundedContext: EsdmName;
    aggregate?: EsdmName;
    event: EsdmName;
    rule: string;
  }>;
}

export interface EsdmExternalSystem extends EsdmDocumentBase {
  kind: 'external-system';
  scope: EsdmScopeDomain;
  direction?: 'inbound' | 'outbound' | 'bidirectional';
  category?: string;
  capabilities?: string[];
}

export interface EsdmEventReference {
  boundedContext: EsdmName;
  aggregate?: EsdmName;
  event: EsdmName;
}

export interface EsdmCommandReference {
  boundedContext: EsdmName;
  aggregate?: EsdmName;
  command: EsdmName;
}

export interface EsdmPolicy extends EsdmDocumentBase {
  kind: 'policy';
  scope: EsdmScopeDomain;
  deliveryGuarantee?: string;
  idempotency?: Record<string, unknown>;
  handles: EsdmEventReference[];
  emits: EsdmCommandReference[];
  constraints?: Array<{ name: string; rule: string }>;
}

export interface EsdmProcessManager extends EsdmDocumentBase {
  kind: 'process-manager';
  scope: EsdmScopeDomain;
  deliveryGuarantee?: string;
  idempotency?: Record<string, unknown>;
  correlatedBy?: Record<string, unknown>;
  state?: Record<string, unknown>;
  invariants?: Array<{ name: string; rule: string }>;
  constraints?: Array<{ name: string; rule: string }>;
  startsWhen: EsdmEventReference[];
  endsWhen?: Array<{ name: string; condition: string }>;
  timers?: Array<Record<string, unknown>>;
  reactions: Array<{
    when: EsdmEventReference | { timer: EsdmName };
    rule: string;
    emits?: EsdmCommandReference[];
    setTimers?: EsdmName[];
    cancelTimers?: EsdmName[];
  }>;
}

export interface EsdmEventHandler extends EsdmDocumentBase {
  kind: 'event-handler';
  scope: EsdmScopeDomain;
  deliveryGuarantee?: string;
  idempotency?: Record<string, unknown>;
  handles: EsdmEventReference[];
  constraints?: Array<{ name: string; rule: string }>;
  sideEffects: Array<
    | { type: 'external-call'; externalSystem: EsdmName; rule: string }
    | { type: 'other'; rule: string }
  >;
}

export interface EsdmContextMapping extends EsdmDocumentBase {
  kind: 'context-mapping';
  type:
    | 'customer-supplier'
    | 'conformist'
    | 'anti-corruption-layer'
    | 'open-host-service'
    | 'published-language'
    | 'shared-kernel'
    | 'partnership'
    | 'separate-ways';
  customer?: EsdmMappingEndpoint;
  supplier?: EsdmMappingEndpoint;
  conformist?: EsdmMappingEndpoint;
  upstream?: EsdmMappingEndpoint;
  downstream?: EsdmMappingEndpoint;
  host?: EsdmMappingEndpoint;
  consumer?: EsdmMappingEndpoint;
  publisher?: EsdmMappingEndpoint;
  participants?: EsdmScopeBoundedContext[];
}

export type EsdmMappingEndpoint = EsdmScopeBoundedContext | { domain: EsdmName; externalSystem: EsdmName };

export interface EsdmActor extends EsdmDocumentBase {
  kind: 'actor';
  scope: EsdmScopeBoundedContext;
  type: 'human' | 'system';
  responsibilities?: string[];
  backedBy?: EsdmName[];
}

export interface EsdmDomainService extends EsdmDocumentBase {
  kind: 'domain-service';
  scope: EsdmScopeBoundedContext;
  functions?: Array<{ name: string; description?: string; rule?: string }>;
}

export type EsdmDocument =
  | EsdmDomain
  | EsdmSubdomain
  | EsdmBoundedContext
  | EsdmAggregate
  | EsdmDynamicConsistencyBoundary
  | EsdmCommand
  | EsdmEvent
  | EsdmQuery
  | EsdmReadModel
  | EsdmExternalSystem
  | EsdmPolicy
  | EsdmProcessManager
  | EsdmEventHandler
  | EsdmContextMapping
  | EsdmActor
  | EsdmDomainService
  | EsdmDocumentBase;

export interface ParsedEsdmModel {
  sourcePath: string;
  documents: EsdmDocument[];
  domains: EsdmDomain[];
  subdomains: EsdmSubdomain[];
  boundedContexts: EsdmBoundedContext[];
  aggregates: EsdmAggregate[];
  dynamicConsistencyBoundaries: EsdmDynamicConsistencyBoundary[];
  commands: EsdmCommand[];
  events: EsdmEvent[];
  queries: EsdmQuery[];
  readModels: EsdmReadModel[];
  externalSystems: EsdmExternalSystem[];
  policies: EsdmPolicy[];
  processManagers: EsdmProcessManager[];
  eventHandlers: EsdmEventHandler[];
  contextMappings: EsdmContextMapping[];
  actors: EsdmActor[];
  domainServices: EsdmDomainService[];
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

export interface SystemOverride {
  boundedContext: string;
  id?: string;
  name?: string;
  version?: string;
  draft?: boolean;
  owners?: string[];
}

/** @deprecated Use systems[] for bounded-context overrides. Kept for backward compatibility. */
export type ServiceOverride = SystemOverride;

export interface ConsistencyUnitOverride {
  boundedContext: string;
  unit: string;
  id?: string;
  name?: string;
  version?: string;
  draft?: boolean;
  owners?: string[];
}

export interface IntegrationOverride {
  name: string;
  id?: string;
  displayName?: string;
  version?: string;
  draft?: boolean;
  owners?: string[];
}

export interface GeneratorOptions {
  models: ModelConfig[];
  domain?: DomainConfig;
  /** Overrides for bounded-context → system mapping. */
  systems?: SystemOverride[];
  /** @deprecated Alias for systems[]. */
  services?: SystemOverride[];
  /** Overrides for consistency-unit → service mapping. */
  units?: ConsistencyUnitOverride[];
  /** Overrides for policies, event-handlers, process-managers, and external systems. */
  integration?: IntegrationOverride[];
  debug?: boolean;
  saveSourceFiles?: boolean;
}

export interface BoundedContextContext {
  domain: EsdmDomain;
  boundedContext: EsdmBoundedContext;
  aggregates: EsdmAggregate[];
  dynamicConsistencyBoundaries: EsdmDynamicConsistencyBoundary[];
  readModels: EsdmReadModel[];
  domainServices: EsdmDomainService[];
  actors: EsdmActor[];
  commands: EsdmCommand[];
  events: EsdmEvent[];
  queries: EsdmQuery[];
}

export type ConsistencyUnitKind = 'aggregate' | 'dynamic-consistency-boundary' | 'read-model' | 'domain-service';

export type IntegrationKind = 'policy' | 'process-manager' | 'event-handler' | 'external-system';

export interface MappedBadge {
  content: string;
  backgroundColor: string;
  textColor: string;
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
  sidebarBadge?: string;
  badges?: MappedBadge[];
  externalSystem?: boolean;
  flows?: Array<{ id: string; version: string }>;
  schema?: Record<string, unknown>;
  draft?: boolean;
  owners?: string[];
  sourceFiles: Array<{ fileName: string; content: string }>;
  /** Where to place the service: inside a BC system or at domain root. */
  placement: 'system' | 'domain';
  boundedContext?: string;
  esdmKind: ConsistencyUnitKind | IntegrationKind;
}

export interface MappedSystemRelationship {
  id: string;
  version: string;
  label: string;
}

export interface MappedSystemActor {
  id: string;
  name: string;
  label?: string;
  direction?: 'inbound' | 'outbound';
}

export interface MappedSystem {
  id: string;
  name: string;
  version: string;
  summary?: string;
  markdown: string;
  boundedContext: string;
  services: Array<{ id: string; version: string }>;
  relationships: MappedSystemRelationship[];
  actors: MappedSystemActor[];
  draft?: boolean;
  owners?: string[];
}

export interface MappedFlowStep {
  id: string;
  title: string;
  summary?: string;
  message?: { id: string; version: string; type: 'event' | 'command' | 'query' };
  service?: { id: string; version: string };
  next_step?: string | { id: string; label?: string };
  next_steps?: Array<string | { id: string; label?: string }>;
}

export interface MappedFlow {
  id: string;
  name: string;
  version: string;
  summary?: string;
  markdown: string;
  steps: MappedFlowStep[];
  draft?: boolean;
  owners?: string[];
  /** Service that owns this flow (process-manager). */
  linkedServiceId?: string;
}

export interface MappedDomain {
  id: string;
  name: string;
  version: string;
  markdown: string;
  draft?: boolean;
  owners?: string[];
  systems: Array<{ id: string; version: string }>;
  services: Array<{ id: string; version: string }>;
}

export interface MappedModel {
  esdmDomain: EsdmDomain;
  domain: MappedDomain;
  systems: MappedSystem[];
  services: MappedService[];
  flows: MappedFlow[];
  messages: MappedMessage[];
}
