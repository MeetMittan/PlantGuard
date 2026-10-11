import mongoose, { type Document, Schema } from 'mongoose';

export interface IPlant extends Document {
  ownerId: mongoose.Types.ObjectId;
  clientId?: string;
  name: string;
  species?: string;
  coverImageUrl?: string;
  carePreferences: {
    wateringIntervalDays?: number;
    checkupIntervalDays?: number;
    notes?: string;
  };
  notes?: string;
  locationLabel?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlantSchema = new Schema<IPlant>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    species: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    coverImageUrl: {
      type: String,
      default: null,
    },
    carePreferences: {
      wateringIntervalDays: { type: Number, min: 1, max: 365, default: 7 },
      checkupIntervalDays: { type: Number, min: 1, max: 365, default: 14 },
      notes: { type: String, default: '' },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    locationLabel: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

PlantSchema.index({ ownerId: 1, isArchived: 1 });
PlantSchema.index({ ownerId: 1, clientId: 1 });

export const Plant = mongoose.model<IPlant>('Plant', PlantSchema);

