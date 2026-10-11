import mongoose, { type Document, Schema } from 'mongoose';

export interface ISavedPlace extends Document {
  ownerId: mongoose.Types.ObjectId;
  clientId?: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  category?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SavedPlaceSchema = new Schema<ISavedPlace>(
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
      maxlength: 120,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'garden',
    },
    isPublic: {
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

SavedPlaceSchema.index({ ownerId: 1, clientId: 1 });
SavedPlaceSchema.index({ latitude: 1, longitude: 1 });

export const SavedPlace = mongoose.model<ISavedPlace>('SavedPlace', SavedPlaceSchema);

