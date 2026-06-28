module.exports = {
  apps: [
    {
      name: "docvault-api",
      cwd: "./backend",
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
