import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  transpilePackages: [
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-placeholder",
    "@tiptap/core",
    "tiptap-markdown",
  ],
  output: isProd ? 'export' : undefined,
  distDir: isProd ? '../backend/public' : '.next',
  images: {
    unoptimized: isProd,
  },
  trailingSlash: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
