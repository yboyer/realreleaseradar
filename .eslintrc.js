module.exports = {
  env: {
    node: true
  },
  extends: [
    "airbnb-base",
    "plugin:prettier/recommended",
    "plugin:ava/recommended"
  ],
  rules: {
    "no-underscore-dangle": "off",
    "no-restricted-syntax": "off",
    "no-await-in-loop": "off",
    "no-console": "off",
  }
};
