import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'NoteBase',
  tagline: 'Architecture Documentation',
  favicon: 'img/favicon.ico',

  url: 'https://alisonbutcher.github.io',
  baseUrl: '/NoteBase/',

  organizationName: 'alisonbutcher',
  projectName: 'NoteBase',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'NoteBase',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/alisonbutcher/NoteBase',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `NoteBase Architecture Documentation`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'sql', 'json', 'yaml'],
    },
    mermaid: {
      theme: {
        light: 'neutral',
        dark: 'dark',
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
