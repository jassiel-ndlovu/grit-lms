import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel Blob serves files from this hostname pattern. Required for
    // next/image to load remote covers/avatars produced by the blob client.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
