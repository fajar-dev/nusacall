/* eslint-disable no-console */
import argon2 from 'argon2';
import { AppDataSource } from '../data-source';
import { OrganizationEntity } from '../../../modules/identity/infrastructure/entities/OrganizationEntity';
import { UserEntity } from '../../../modules/identity/infrastructure/entities/UserEntity';

export async function runSeeder() {
  console.log('🌱 Starting NusaCall Database Seeder...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const orgRepo = AppDataSource.getRepository(OrganizationEntity);
  const userRepo = AppDataSource.getRepository(UserEntity);

  // 1. Seed Organization
  let org = await orgRepo.findOne({ where: { slug: 'demo' } });
  if (!org) {
    org = orgRepo.create({
      id: '01H00000000000000000000ORG',
      name: 'NusaCall Demo Center',
      slug: 'demo',
      timezone: 'Asia/Jakarta',
      defaultLocale: 'id',
      status: 'ACTIVE',
      recordingPolicy: 'ALWAYS',
      transcriptionPolicy: 'ALWAYS',
      announcementLanguage: 'id',
      mediaRetentionDays: 365,
      cprDailyLimit: 1,
    });
    await orgRepo.save(org);
    console.log('✅ Created Organization: NusaCall Demo Center (slug: demo)');
  } else {
    console.log('ℹ️ Organization "demo" already exists.');
  }

  // Common password hash for demo accounts
  const passwordHash = await argon2.hash('Password123!', { type: argon2.argon2id });

  // 2. Seed Users
  const defaultUsers = [
    {
      id: '01H000000000000000000ADM0',
      email: 'admin@nusacall.com',
      fullName: 'System Administrator',
      role: 'ADMIN',
    },
    {
      id: '01H000000000000000000SUP0',
      email: 'supervisor@nusacall.com',
      fullName: 'Call Center Supervisor',
      role: 'SUPERVISOR',
    },
    {
      id: '01H000000000000000000AGT0',
      email: 'agent@nusacall.com',
      fullName: 'Call Center Agent',
      role: 'AGENT',
    },
  ];

  for (const userSeed of defaultUsers) {
    let user = await userRepo.findOne({ where: { email: userSeed.email } });
    if (!user) {
      user = userRepo.create({
        id: userSeed.id,
        organizationId: org.id,
        email: userSeed.email,
        passwordHash,
        fullName: userSeed.fullName,
        role: userSeed.role,
        status: 'ACTIVE',
        totpEnabled: 0,
        failedLoginCount: 0,
        locale: 'id',
      });
      await userRepo.save(user);
      console.log(`✅ Created User: ${userSeed.email} (${userSeed.role})`);
    } else {
      console.log(`ℹ️ User "${userSeed.email}" already exists.`);
    }
  }

  console.log('\n🎉 Seeding finished successfully!');
  console.log('----------------------------------------------------');
  console.log('🔑 Login Credentials:');
  console.log('  Email:    admin@nusacall.com | supervisor@nusacall.com | agent@nusacall.com');
  console.log('  Password: Password123!');
  console.log('----------------------------------------------------\n');
}

if (process.env.NODE_ENV !== 'test') {
  runSeeder()
    .then(async () => {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeder failed:', err);
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(1);
    });
}
