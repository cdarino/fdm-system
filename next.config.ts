import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled to support dynamic data fetching in pages
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    // Server Actions cap request bodies at 1MB by default, which a scanned deed
    // clears easily. The limit covers the whole raw multipart body, including
    // boundaries and part headers, so this sits above the bucket's own 10MB
    // ceiling to leave room for that overhead.
    serverActions: { bodySizeLimit: '11mb' },
  },
};

export default nextConfig;
