const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  beszelUrl: (process.env.BESZEL_URL ?? "http://beszel:8090").replace(/\/$/, ""),
  apiKey: process.env.BESZEL_API_KEY ?? "",
  email: process.env.BESZEL_EMAIL ?? "",
  password: process.env.BESZEL_PASSWORD ?? "",
  refreshInterval: parseInt(process.env.REFRESH_INTERVAL ?? "30000", 10),
  requestTimeout: 10000,
};

export default config;
