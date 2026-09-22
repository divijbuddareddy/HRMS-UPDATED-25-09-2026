import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  isPrismaOptimized: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Apply SQLite high-concurrency PRAGMA optimizations once on startup
if (!globalForPrisma.isPrismaOptimized) {
  globalForPrisma.isPrismaOptimized = true;
  (async () => {
    try {
      // WAL (Write-Ahead Logging) allows concurrent readers alongside writers
      await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      // 10-second busy timeout prevents lock collisions under 1000-user load
      await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
      // NORMAL synchronous mode gives high-throughput write performance in WAL mode
      await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
      // 64MB in-memory page cache for lightning-fast lookups
      await prisma.$queryRawUnsafe('PRAGMA cache_size = -64000;');
    } catch {
      // Ignore if using external provider or during schema push
    }
  })();
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
