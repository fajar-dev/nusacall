import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from '../../bootstrap/config';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: config.DATABASE_HOST,
  port: config.DATABASE_PORT,
  username: config.DATABASE_USER,
  password: config.DATABASE_PASSWORD,
  database: config.DATABASE_NAME,
  synchronize: false, // Rule N2: NEVER use synchronize: true
  logging: config.NODE_ENV === 'development',
  entities: [__dirname + '/../../modules/**/infrastructure/*OrmEntity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  subscribers: [],
});
