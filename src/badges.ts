import type { MappedBadge } from './types.js';

export interface KindBadgeStyle {
  label: string;
  backgroundColor: string;
  textColor: string;
}

export const KIND_BADGE_STYLES: Record<string, KindBadgeStyle> = {
  domain: {
    label: 'Domain',
    backgroundColor: '#6915d6',
    textColor: '#ffffff',
  },
  'bounded-context': {
    label: 'Bounded Context',
    backgroundColor: '#8e51ff',
    textColor: '#ffffff',
  },
  aggregate: {
    label: 'Aggregate',
    backgroundColor: '#0071a7',
    textColor: '#ffffff',
  },
  'dynamic-consistency-boundary': {
    label: 'DCB',
    backgroundColor: '#0071a7',
    textColor: '#ffffff',
  },
  'read-model': {
    label: 'Read Model',
    backgroundColor: '#00801d',
    textColor: '#ffffff',
  },
  'domain-service': {
    label: 'Domain Service',
    backgroundColor: '#be0e46',
    textColor: '#ffffff',
  },
  command: {
    label: 'Command',
    backgroundColor: '#2b7fff',
    textColor: '#ffffff',
  },
  event: {
    label: 'Event',
    backgroundColor: '#ff6900',
    textColor: '#ffffff',
  },
  query: {
    label: 'Query',
    backgroundColor: '#00c950',
    textColor: '#ffffff',
  },
  policy: {
    label: 'Policy',
    backgroundColor: '#a34204',
    textColor: '#ffffff',
  },
  'process-manager': {
    label: 'Process Manager',
    backgroundColor: '#a34204',
    textColor: '#ffffff',
  },
  'event-handler': {
    label: 'Event Handler',
    backgroundColor: '#a34204',
    textColor: '#ffffff',
  },
  'external-system': {
    label: 'External',
    backgroundColor: '#4b5563',
    textColor: '#ffffff',
  },
  events: {
    label: 'Events',
    backgroundColor: '#a34204',
    textColor: '#ffffff',
  },
};

const esdmLabelsToBadges = (labels?: Record<string, string>): MappedBadge[] | undefined => {
  if (!labels) {
    return undefined;
  }

  return Object.entries(labels).map(([key, value]) => ({
    content: `${key}:${value}`,
    backgroundColor: '#52525b',
    textColor: '#ffffff',
  }));
};

export const kindBadgeStyle = (kindKey: string): KindBadgeStyle =>
  KIND_BADGE_STYLES[kindKey] ?? { label: kindKey, backgroundColor: '#4b5563', textColor: '#ffffff' };

const kindToBadge = (style: KindBadgeStyle): MappedBadge => ({
  content: style.label,
  backgroundColor: style.backgroundColor,
  textColor: style.textColor,
});

export const buildServiceBadges = (kindKey: string, labels?: Record<string, string>): MappedBadge[] => [
  kindToBadge(kindBadgeStyle(kindKey)),
  ...(esdmLabelsToBadges(labels) ?? []),
];

export const kindBadgeFields = (kindKey: string, labels?: Record<string, string>) => {
  const style = kindBadgeStyle(kindKey);
  return {
    sidebarBadge: style.label,
    badges: buildServiceBadges(kindKey, labels),
  };
};

export interface BadgePayloadSource {
  sidebarBadge?: string;
  badges?: MappedBadge[];
}

export const buildBadgePayload = (resource: BadgePayloadSource) => ({
  ...(resource.sidebarBadge
    ? {
        sidebar: {
          badge: resource.sidebarBadge,
          ...(resource.badges?.[0]
            ? {
                color: resource.badges[0].textColor,
                backgroundColor: resource.badges[0].backgroundColor,
              }
            : {}),
        },
      }
    : {}),
  ...(resource.badges?.length ? { badges: resource.badges } : {}),
});
