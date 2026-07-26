import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photography is served from the Unsplash CDN (free for commercial use,
    // no attribution required). next/image handles resizing + AVIF/WebP.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
