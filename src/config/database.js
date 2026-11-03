import { PrismaClient } from '@prisma/client';

let prismaInstance = null;

export const getPrisma = () => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
};

export const prisma = getPrisma();

export const checkDatabaseHealth = async () => {
  try {
    // Quick query to verify SQLite connection
    const res = await prisma.$queryRawUnsafe('SELECT 1 as result;');
    if (res && res.length > 0) {
      return { connected: true, message: 'SQLite database connected via Prisma' };
    }
    return { connected: true, message: 'SQLite database reachable' };
  } catch (error) {
    return { connected: false, message: error.message };
  }
};
