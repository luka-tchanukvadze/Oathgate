import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // next dev and next build both own .next, and a build clears it before it
  // writes. Running one while the other is up leaves the dev server reading
  // manifests that were deleted a moment ago, which arrives as a pile of ENOENT
  // Setting this lets a check build write somewhere else and leave dev alone
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
