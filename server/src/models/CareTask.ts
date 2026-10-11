import mongoose, { type Document, Schema } from 'mongoose';

export interface ICareTask extends Document {
  ownerId: mongoose.Types.ObjectId;
  clientId?: string;
  plantId?: mongoose.Types.ObjectId;
  clientPlantId?: string;
  type: 'watering' | 'fertilizing' | 'pruning' | 'inspection' | 'custom';
  title: string;
  frequencyDays: number;
  lastCompletedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CareTaskSchema = new Schema<ICareTask>(
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
    type: {
      type: String,
      enum: ['watering', 'fertilizing', 'pruning', 'inspection', 'custom'],
      default: 'watering',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    frequencyDays: {
      type: Number,
      required: true,
      min: 1,
      max: 365,
      default: 7,
    },
    lastCompletedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
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

CareTaskSchema.index({ ownerId: 1, isActive: 1 });
CareTaskSchema.index({ ownerId: 1, clientId: 1 });

export const CareTask = mongoose.model<ICareTask>('CareTask', CareTaskSchema);

