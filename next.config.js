// Конфигурация для статического экспорта под GitHub Pages (адрес /crossdock-test/)
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/crossdock-test',
  images: { unoptimized: true },
};
module.exports = nextConfig;
