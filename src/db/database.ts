import Dexie, { type EntityTable } from 'dexie';
import { SCHEMA_VERSIONS } from './migrations';
import type {
  AppMetadataRecord,
  AssessmentRecord,
  CareCompletion,
  CareEvent,
  CareTask,
  Observation,
  Plant,
  SavedPlace,
  SettingRecord,
} from './schema';

export const DATABASE_NAME = 'plantguard';

export class PlantGuardDatabase extends Dexie {
  observations!: EntityTable<Observation, 'id'>;
  assessments!: EntityTable<AssessmentRecord, 'id'>;
  plants!: EntityTable<Plant, 'id'>;
  careEvents!: EntityTable<CareEvent, 'id'>;
  careTasks!: EntityTable<CareTask, 'id'>;
  careCompletions!: EntityTable<CareCompletion, 'id'>;
  savedPlaces!: EntityTable<SavedPlace, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  appMetadata!: EntityTable<AppMetadataRecord, 'key'>;

  constructor(name = DATABASE_NAME, versions = SCHEMA_VERSIONS) {
    super(name);
    for (const schema of versions) {
      const version = this.version(schema.version).stores(schema.stores);
      if (schema.upgrade) version.upgrade(schema.upgrade);
    }
  }
}

export const db = new PlantGuardDatabase();
