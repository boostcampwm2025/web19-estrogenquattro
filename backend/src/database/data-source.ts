import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { loadEnvFilesOnce } from '../config/env-files';

loadEnvFilesOnce();

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DB_PATH ?? 'data/jandi.sqlite',
  synchronize:
    process.env.DB_SYNCHRONIZE === 'true' &&
    process.env.NODE_ENV !== 'production',
  logging: false,

  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});

export default AppDataSource;
