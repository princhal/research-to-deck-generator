/** @type {import('next').NextConfig} */
const nextConfig = {
  // The BullMQ worker runs as a separate Node process (src/worker/index.ts),
  // not inside Next.js — Vercel's serverless functions cannot host a
  // long-running queue consumer. See README "Deployment" section.
};

export default nextConfig;
