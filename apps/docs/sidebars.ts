import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'README',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Requirements',
      collapsed: false,
      items: [
        'functional-requirements',
        'non-functional-requirements',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/c4-context',
        'architecture/c4-containers',
        'architecture/c4-components-api',
        'aws-deployment-topology',
        'security-architecture',
        'sequences',
      ],
    },
    {
      type: 'category',
      label: 'Data',
      collapsed: false,
      items: [
        'data-model',
      ],
    },
    {
      type: 'category',
      label: 'Architecture Decision Records',
      collapsed: false,
      items: [
        'adr/ADR-001-event-sourcing',
        'adr/ADR-002-nestjs-backend',
        'adr/ADR-003-postgres-event-store',
        'adr/ADR-004-dynamodb-read-store',
        'adr/ADR-005-rabbitmq-over-sqs',
        'adr/ADR-006-interface-abstractions',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      collapsed: false,
      items: [
        'local-development',
      ],
    },
  ],
};

export default sidebars;
