import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'data/jandi.sqlite',
  synchronize: false,
  logging: false,

  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
