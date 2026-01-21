module.exports = {
  apps: [
    {
      name: 'backend-loadtest',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      env: {
        LOAD_TEST_MODE: 'true',
      },
    },
  ],
};