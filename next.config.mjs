/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dashboard moved from / to /app. Keep old bookmarks working.
  async redirects() {
    return ["analytics", "sessions", "customers", "transactions", "apis", "setup", "settings", "profile"].map((p) => ({
      source: `/${p}/:rest*`,
      destination: `/app/${p}/:rest*`,
      permanent: false,
    }));
  },
};

export default nextConfig;
