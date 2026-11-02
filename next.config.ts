import type { NextConfig } from "next";

// Host that will serve product images once a backend exists
const mediaHost = process.env.NEXT_PUBLIC_MEDIA_HOST;

const nextConfig: NextConfig = {
  typedRoutes: true,

  experimental: {
    // Registration uploads up to three document copies of 4 MB each (MAX_DOCUMENT_BYTES) in one action.
    serverActions: { bodySizeLimit: "13mb" },
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: mediaHost
      ? [{ protocol: "https", hostname: mediaHost }]
      : [],
  },
};

export default nextConfig;
