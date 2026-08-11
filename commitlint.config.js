module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore']
    ],
    'scope-enum': [
      1,
      'always',
      ['calling', 'routing', 'media', 'web', 'infra', 'identity', 'tenancy', 'wa-accounts', 'permissions', 'contacts', 'callbacks', 'analytics', 'entrypoints', 'notifications', 'audit']
    ]
  }
};
