import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
  ...nextConfig,
  {
    ignores: ["coverage/**", "__tests__/**"],
  },
];

export default config;
