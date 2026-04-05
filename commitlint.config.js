module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build', 'chore', 'ci', 'docs', 'feat', 'fix',
        'perf', 'refactor', 'release', 'revert', 'style', 'test',
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'body-max-line-length': [1, 'always', 200],
  },
}
