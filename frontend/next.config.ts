import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      fs: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/github-image/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/github-image/:path*",
        destination: "https://github.com/:path*",
      },
    ];
  },
};

export default nextConfig;
