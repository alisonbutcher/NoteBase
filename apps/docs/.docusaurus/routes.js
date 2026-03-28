import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/NoteBase/',
    component: ComponentCreator('/NoteBase/', '45c'),
    routes: [
      {
        path: '/NoteBase/',
        component: ComponentCreator('/NoteBase/', '084'),
        routes: [
          {
            path: '/NoteBase/',
            component: ComponentCreator('/NoteBase/', '36b'),
            routes: [
              {
                path: '/NoteBase/adr/ADR-001-event-sourcing',
                component: ComponentCreator('/NoteBase/adr/ADR-001-event-sourcing', 'b7c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/adr/ADR-002-nestjs-backend',
                component: ComponentCreator('/NoteBase/adr/ADR-002-nestjs-backend', '3b5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/adr/ADR-003-postgres-event-store',
                component: ComponentCreator('/NoteBase/adr/ADR-003-postgres-event-store', '52e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/adr/ADR-004-dynamodb-read-store',
                component: ComponentCreator('/NoteBase/adr/ADR-004-dynamodb-read-store', 'f1a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/adr/ADR-005-rabbitmq-over-sqs',
                component: ComponentCreator('/NoteBase/adr/ADR-005-rabbitmq-over-sqs', '3d0'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/adr/ADR-006-interface-abstractions',
                component: ComponentCreator('/NoteBase/adr/ADR-006-interface-abstractions', 'cf0'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/architecture/c4-components-api',
                component: ComponentCreator('/NoteBase/architecture/c4-components-api', 'd35'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/architecture/c4-containers',
                component: ComponentCreator('/NoteBase/architecture/c4-containers', 'a0c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/architecture/c4-context',
                component: ComponentCreator('/NoteBase/architecture/c4-context', '87b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/aws-deployment-topology',
                component: ComponentCreator('/NoteBase/aws-deployment-topology', 'c65'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/data-model',
                component: ComponentCreator('/NoteBase/data-model', '8f5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/functional-requirements',
                component: ComponentCreator('/NoteBase/functional-requirements', '879'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/local-development',
                component: ComponentCreator('/NoteBase/local-development', 'e4b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/non-functional-requirements',
                component: ComponentCreator('/NoteBase/non-functional-requirements', 'ba4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/security-architecture',
                component: ComponentCreator('/NoteBase/security-architecture', '8a7'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/sequences',
                component: ComponentCreator('/NoteBase/sequences', 'c47'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/NoteBase/',
                component: ComponentCreator('/NoteBase/', '3e1'),
                exact: true,
                sidebar: "docs"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
