import { app } from './app.js';
import { serverConfig } from './config.js';

const server = app.listen(serverConfig.PORT, () => {
  console.log(`===============================================`);
  console.log(` PlantGuard AI Express Server running`);
  console.log(` Port: ${serverConfig.PORT}`);
  console.log(` Gemini Model: ${serverConfig.GEMINI_MODEL}`);
  console.log(` AI Configured: ${serverConfig.isConfigured ? 'Yes (API key provided)' : 'No (API key missing)'}`);
  console.log(` Allowed Origins: ${serverConfig.allowedOrigins.join(', ')}`);
  console.log(` Health Endpoint: http://localhost:${serverConfig.PORT}/api/health`);
  console.log(`===============================================`);
});

const shutdown = () => {
  console.log('Shutting down PlantGuard server gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

