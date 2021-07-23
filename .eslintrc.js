module.exports = {
  extends: [
    'plugin:prettier/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
  ],
  plugins: ['import', 'prettier'],
  parserOptions: {
    ecmaVersion: 2020,
  },
  env: {
    node: true,
    es6: true,
  },
  rules: {
    'prefer-const': 'warn',
    'max-lines': 'warn',
    'prefer-template': 'error',
    'no-undef': 'error',
    'no-unused-vars': 'error',
    'max-lines': 'off',
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        semi: false,
        bracketSpacing: true,
        tabWidth: 2,
      },
    ],
  },
}
