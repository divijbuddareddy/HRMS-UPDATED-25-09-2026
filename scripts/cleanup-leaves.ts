import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.leaveRequest.deleteMany({
    where: {
      employee: {
        workEmail: { in: ['emp1@aiautomationlabs.com', 'admin@aiautomationlabs.com'] },
      },
    },
  });
  console.log('Cleaned up conflicting leave requests count:', deleted.count);
}

main().finally(() => prisma.$disconnect());
