import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
  ...nextConfig,
  {
    ignores: ["coverage/**"],
  },
  {
    settings: {
      react: {
        version: "18",
      },
    },
  },
];

export default config;
