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
      // Keep the compiler cache on disk so a long Fast Refresh session does
      // not grow the Node heap until OOM abort (which used to leave port 3000 stuck).
      config.cache = { type: "filesystem" }
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
