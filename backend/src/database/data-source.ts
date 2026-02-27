import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'data/jandi.sqlite',
  synchronize: process.env.NODE_ENV === 'development',
  logging: false,

  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});

export default AppDataSource;
