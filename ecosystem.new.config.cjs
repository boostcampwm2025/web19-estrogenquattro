module.exports = {
  apps: [
    {
      name: 'mogakco-single',
      script: './dist/index.js',
      cwd: './server',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      error_file: '../logs/error.log',
      out_file: '../logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
