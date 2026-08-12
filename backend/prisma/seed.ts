import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !email || !password) {
    throw new Error(
      'ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD must be defined',
    );
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: Role.ADMIN,
    },
  });

  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.username}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Admin created: ${admin.username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
