/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a fully static build in `out/` so it can be served from the
  // Electron desktop shell (no Node server required at runtime).
  output: "export",
  // Emit `path/index.html` files which are simpler to resolve from the
  // custom `app://` protocol used by the Electron main process.
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // One regexp is a legal WatchOptions.ignored value. Hub writes, Cursor
      // junk, and build output must not Fast Refresh the UI (that reordered CSS
      // and snapped the skin back to unskinned Tailwind).
      // Leave config.cache alone. Next already uses a filesystem cache with
      // maxMemoryGenerations: 0 (the heap bound that used to OOM port 3000).
      // Replacing it with `{ type: "filesystem" }` drops the versioned
      // cacheDirectory, so the client and server compilers stall and the
      // browser times out loading app/layout.js (ChunkLoadError).
      config.watchOptions = {
        ...config.watchOptions,
        ignored:
          /node_modules|[\\/]\.git[\\/]|[\\/]data[\\/]|[\\/]\.next[\\/]|[\\/]out[\\/]|[\\/]dist[\\/]|[\\/]\.cursor[\\/]/,
      }
    }
    return config
  },
}

export default nextConfig
