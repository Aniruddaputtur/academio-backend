import { app } from './app.js';
import { config } from './config/environment.js';
import { checkDatabaseHealth, prisma } from './config/database.js';

const startServer = async () => {
  // Test SQLite / Prisma readiness on boot
  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.connected) {
    console.error(`[Database Error] Failed to connect to SQLite: ${dbHealth.message}`);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`=============================================================`);
    console.log(`[Academio Backend] Server listening on port ${config.port}`);
    console.log(`[Academio Backend] Environment: ${config.nodeEnv}`);
    console.log(`[Academio Backend] Database: SQLite via Prisma (Active)`);
    console.log(`[Academio Backend] OpenAI Model: ${config.openaiModel}`);
    console.log(`[Academio Backend] Health Check: http://localhost:${config.port}/api/health`);
    console.log(`=============================================================`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[Academio Backend] ${signal} received. Closing database & shutting down gracefully...`);
    await prisma.$disconnect();
    server.close(() => {
      console.log('[Academio Backend] Closed out remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  console.error('[Startup Error]', err);
  process.exit(1);
});
