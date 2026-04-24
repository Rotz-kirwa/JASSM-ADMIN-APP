import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create Roles
  const roles = [
    { name: 'SUPER_ADMIN', permissions: ['*'] },
    { name: 'ADMIN', permissions: ['read', 'write'] },
    { name: 'FINANCE', permissions: ['read:payments'] },
    { name: 'SUPPORT', permissions: ['read:customers', 'read:sms'] },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // Create Super Admin
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (superAdminRole) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'eliudkirwa451@gmail.com' },
      update: {},
      create: {
        email: 'eliudkirwa451@gmail.com',
        name: 'Super Admin',
        password: hashedPassword,
        roleId: superAdminRole.id,
      },
    });
  }

  // Create Initial SMS Template
  await prisma.sMSTemplate.upsert({
    where: { name: 'Payment Received' },
    update: {},
    create: {
      name: 'Payment Received',
      content: 'Hi {{name}}, we have received your payment of KES {{amount}}. Transaction Code: {{transaction_code}}. Thank you for choosing JASSM.',
      isActive: true,
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
