module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:boundaries/recommended',
    'prettier'
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true
      }
    },
    'boundaries/elements': [
      {
        type: 'shared',
        pattern: 'src/shared/**'
      },
      {
        type: 'domain',
        pattern: 'src/modules/*/domain/**'
      },
      {
        type: 'application',
        pattern: 'src/modules/*/application/**'
      },
      {
        type: 'infrastructure',
        pattern: 'src/modules/*/infrastructure/**'
      },
      {
        type: 'interface',
        pattern: 'src/modules/*/interface/**'
      },
      {
        type: 'infra-global',
        pattern: 'src/infrastructure/**'
      },
      {
        type: 'interface-global',
        pattern: 'src/interface/**'
      }
    ]
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          {
            from: ['domain'],
            allow: ['shared']
          },
          {
            from: ['application'],
            allow: ['domain', 'shared']
          },
          {
            from: ['infrastructure'],
            allow: ['domain', 'application', 'shared', 'infra-global']
          },
          {
            from: ['interface', 'interface-global'],
            allow: ['application', 'shared', 'domain']
          },
          {
            from: ['shared'],
            allow: ['shared']
          },
          {
            from: ['infra-global'],
            allow: ['domain', 'application', 'shared', 'infra-global']
          }
        ]
      }
    ]
  }
};
