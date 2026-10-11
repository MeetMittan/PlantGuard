import mongoose, { type Document, Schema } from 'mongoose';

export interface IObservation extends Document {
  ownerId: mongoose.Types.ObjectId;
  clientId?: string;
  plantId?: mongoose.Types.ObjectId;
  clientPlantId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    label?: string;
  };
  notes?: string;
  timestamp: Date;
  shareVisibility: 'private' | 'connections' | 'public';
  assessment?: {
    provider: string;
    modelId: string;
    isPlant: string;
    plantName?: string;
    healthStatus: string;
    visibleSymptoms: string[];
    possibleCauses: Array<{
      name: string;
      confidenceText?: string;
      explanation: string;
    }>;
    limitations: string[];
    recommendations: string[];
    qualityVerdict: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ObservationSchema = new Schema<IObservation>(
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
    plantId: {
      type: Schema.Types.ObjectId,
      ref: 'Plant',
      default: null,
      index: true,
    },
    clientPlantId: {
      type: String,
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      label: { type: String, default: '' },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    shareVisibility: {
      type: String,
      enum: ['private', 'connections', 'public'],
      default: 'private',
      index: true,
    },
    assessment: {
      provider: { type: String, default: 'gemini' },
      modelId: { type: String, default: 'gemini-3.8-flash' },
      isPlant: { type: String, default: 'yes' },
      plantName: { type: String, default: '' },
      healthStatus: { type: String, default: 'unknown' },
      visibleSymptoms: [{ type: String }],
      possibleCauses: [
        {
          name: { type: String },
          confidenceText: { type: String },
          explanation: { type: String },
        },
      ],
      limitations: [{ type: String }],
      recommendations: [{ type: String }],
      qualityVerdict: { type: String, default: 'suitable' },
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

ObservationSchema.index({ ownerId: 1, timestamp: -1 });
ObservationSchema.index({ ownerId: 1, clientId: 1 });

export const Observation = mongoose.model<IObservation>('Observation', ObservationSchema);

