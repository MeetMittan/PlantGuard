import { connectDatabase, disconnectDatabase } from './connection.js';
import {
  User,
  Plant,
  CareTask,
  CareCompletion,
  Observation,
  SavedPlace,
  UserConnection,
  Notification,
  getCanonicalPair,
} from '../models/index.js';
import { hashPassword } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';

export async function seedDatabase() {
  await connectDatabase();
  logger.info('Starting database seeding...');

  // 1. Seed or find Demo User
  let demoUser = await User.findOne({ email: 'demo@plantguard.internal' });
  if (!demoUser) {
    const passwordHash = await hashPassword('PlantGuardDemo123!');
    demoUser = await User.create({
      username: 'demouser',
      email: 'demo@plantguard.internal',
      passwordHash,
      displayName: 'Demo Botanist',
      bio: 'Urban indoor plant enthusiast caring for tropicals and succulents.',
      privacySettings: {
        isPublic: true,
        shareObservations: true,
        shareLocations: true,
      },
      status: 'active',
    });
    logger.info(`Created demo user: ${demoUser.email} (demouser)`);
  } else {
    logger.info(`Demo user already exists: ${demoUser.email}`);
  }

  // 2. Seed or find Community Friend User
  let floraUser = await User.findOne({ email: 'flora@plantguard.internal' });
  if (!floraUser) {
    const passwordHash = await hashPassword('PlantGuardDemo123!');
    floraUser = await User.create({
      username: 'flora_expert',
      email: 'flora@plantguard.internal',
      passwordHash,
      displayName: 'Flora Green',
      bio: 'Horticulturist, rare aroid collector, and community plant doctor.',
      privacySettings: {
        isPublic: true,
        shareObservations: true,
        shareLocations: true,
      },
      status: 'active',
    });
    logger.info(`Created community user: ${floraUser.email}`);
  }

  // 3. Establish mutual connection between demouser & flora_expert
  const pair = getCanonicalPair(demoUser._id, floraUser._id);
  const existingConn = await UserConnection.findOne(pair);
  if (!existingConn) {
    await UserConnection.create({
      ...pair,
      status: 'connected',
    });
    logger.info('Created mutual connection between Demo Botanist and Flora Green');
  }

  // 4. Seed Plants for Demo User
  let monstera = await Plant.findOne({ ownerId: demoUser._id, name: 'Monstera Deliciosa' });
  if (!monstera) {
    monstera = await Plant.create({
      ownerId: demoUser._id,
      name: 'Monstera Deliciosa',
      species: 'Monstera deliciosa',
      locationLabel: 'Living Room - East Window',
      notes: 'Thriving with fenestrations. Repotted into chunky aroid mix last spring.',
      carePreferences: {
        wateringIntervalDays: 7,
        checkupIntervalDays: 14,
        notes: 'Water when top 2 inches of soil feel completely dry.',
      },
      isArchived: false,
    });
    logger.info('Created Monstera Deliciosa plant');
  }

  let snakePlant = await Plant.findOne({ ownerId: demoUser._id, name: 'Snake Plant' });
  if (!snakePlant) {
    snakePlant = await Plant.create({
      ownerId: demoUser._id,
      name: 'Snake Plant',
      species: 'Dracaena trifasciata',
      locationLabel: 'Bedroom Shelf',
      notes: 'Tough survivor, low light tolerant.',
      carePreferences: {
        wateringIntervalDays: 21,
        checkupIntervalDays: 30,
        notes: 'Allow soil to dry out completely between waterings.',
      },
      isArchived: false,
    });
    logger.info('Created Snake Plant');
  }

  // 5. Seed Care Tasks
  let waterMonstera = await CareTask.findOne({ ownerId: demoUser._id, plantId: monstera._id, type: 'watering' });
  if (!waterMonstera) {
    waterMonstera = await CareTask.create({
      ownerId: demoUser._id,
      plantId: monstera._id,
      type: 'watering',
      title: 'Water Monstera',
      frequencyDays: 7,
      isActive: true,
      lastCompletedAt: new Date(),
    });
    logger.info('Created Care Task: Water Monstera');
  }

  let inspectPests = await CareTask.findOne({ ownerId: demoUser._id, type: 'inspection', title: 'Weekly Leaf Health Inspection' });
  if (!inspectPests) {
    inspectPests = await CareTask.create({
      ownerId: demoUser._id,
      type: 'inspection',
      title: 'Weekly Leaf Health Inspection',
      frequencyDays: 7,
      isActive: true,
      lastCompletedAt: new Date(),
    });
    logger.info('Created Care Task: Weekly Inspection');
  }

  // 6. Seed today's Care Completion
  const today = new Date().toISOString().slice(0, 10);
  const existingCompletion = await CareCompletion.findOne({
    ownerId: demoUser._id,
    taskId: waterMonstera._id,
    completedDate: today,
  });
  if (!existingCompletion) {
    await CareCompletion.create({
      ownerId: demoUser._id,
      taskId: waterMonstera._id,
      completedDate: today,
      notes: 'Soil moisture tested with wooden chopstick; gave 400ml filtered water.',
      idempotencyKey: `seed-completion-${today}`,
    });
    logger.info(`Created Care Completion for ${today}`);
  }

  // 7. Seed Observation
  const existingObs = await Observation.findOne({ ownerId: demoUser._id, plantId: monstera._id });
  if (!existingObs) {
    await Observation.create({
      ownerId: demoUser._id,
      plantId: monstera._id,
      timestamp: new Date(),
      shareVisibility: 'connections',
      notes: 'New leaf unfurled with 4 splits! Checked undersides for spider mites.',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        label: 'San Francisco Botanical Conservatory',
      },
      assessment: {
        provider: 'gemini',
        modelId: 'gemini-3.8-flash',
        isPlant: 'yes',
        plantName: 'Monstera deliciosa (Swiss Cheese Plant)',
        healthStatus: 'healthy',
        visibleSymptoms: ['Vibrant deep green foliage', 'Normal secondary fenestrations', 'Firm turgid petioles'],
        possibleCauses: [
          {
            name: 'Optimal growth conditions',
            confidenceText: 'High (95%)',
            explanation: 'Sufficient ambient light and balanced hydration promote healthy chlorophyll development.',
          },
        ],
        limitations: ['Visual evaluation only; root health cannot be verified without soil check.'],
        recommendations: [
          'Rotate plant 90 degrees every month for balanced canopy development.',
          'Wipe broad leaves with a damp cloth every 2 weeks to optimize photosynthetic efficiency.',
        ],
        qualityVerdict: 'suitable',
      },
    });
    logger.info('Created sample healthy observation');
  }

  // 8. Seed Saved Places for Nature Explorer
  const existingPlace = await SavedPlace.findOne({ ownerId: demoUser._id, name: 'Golden Gate Conservatory of Flowers' });
  if (!existingPlace) {
    await SavedPlace.create({
      ownerId: demoUser._id,
      name: 'Golden Gate Conservatory of Flowers',
      latitude: 37.7726,
      longitude: -122.4601,
      category: 'garden',
      description: 'Historic Victorian greenhouse featuring exotic rare tropical flora and palms.',
      isPublic: true,
    });
    logger.info('Created sample Saved Place');
  }

  // 9. Seed Notification
  const existingNotification = await Notification.findOne({ recipientId: demoUser._id });
  if (!existingNotification) {
    await Notification.create({
      recipientId: demoUser._id,
      senderId: floraUser._id,
      type: 'connection_accepted',
      title: 'Connected with Flora Green',
      message: 'Flora Green accepted your connection request. You can now view each other\'s shared observations!',
      isRead: false,
    });
    logger.info('Created sample Notification');
  }

  logger.info('Database seeding completed successfully!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  (async () => {
    try {
      await seedDatabase();
      await disconnectDatabase();
      console.log('✅ MongoDB database seeded successfully!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Failed seeding database:', err);
      process.exit(1);
    }
  })();
}

