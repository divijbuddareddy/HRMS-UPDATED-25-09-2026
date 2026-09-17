import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.leaveRequest.findMany({
    include: { employee: true, leaveType: true },
  });
  console.log('Total Leave Requests:', reqs.length);
  for (const r of reqs) {
    console.log({
      id: r.id,
      employee: r.employee?.workEmail,
      leaveType: r.leaveType?.code,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      status: r.status,
      totalDays: r.totalDays,
    });
  }
}

main().finally(() => prisma.$disconnect());
