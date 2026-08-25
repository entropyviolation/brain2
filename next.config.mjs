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
}

export default nextConfig
