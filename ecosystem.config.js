module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
    },
    {
      name: 'frontend',
      cwd: './frontend',
      script: 'pnpm run dev',
      args: 'start -p 3000',
      instances: 1,
    }
  ]
}