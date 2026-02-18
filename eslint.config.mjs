import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
  ...nextConfig,
  {
    ignores: ["coverage/**"],
  },
  {
    rules: {
      // eslint-plugin-react bundled with eslint-config-next calls the removed
      // context.getFilename() API in ESLint v10, crashing the linter.
      // Disable until eslint-config-next ships a compatible plugin version.
      "react/display-name": "off",
    },
  },
];

export default config;
