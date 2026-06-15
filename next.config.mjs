/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow mobile devices on the same WiFi network to access dev resources
  allowedDevOrigins: ['10.23.95.192', 'localhost'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        // Supabase storage – replace <project-ref> with your project reference
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
