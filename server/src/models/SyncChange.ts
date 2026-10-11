import mongoose, { type Document, Schema } from 'mongoose';

export type SyncEntityType = 'plant' | 'observation' | 'careTask' | 'careCompletion' | 'savedPlace';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface ISyncChange extends Document {
  ownerId: mongoose.Types.ObjectId;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  serverVersion: number;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SyncChangeSchema = new Schema<ISyncChange>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['plant', 'observation', 'careTask', 'careCompletion', 'savedPlace'],
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    operation: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete'],
    },
    serverVersion: {
      type: Number,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
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

SyncChangeSchema.index({ ownerId: 1, serverVersion: 1 });
SyncChangeSchema.index({ ownerId: 1, entityType: 1, entityId: 1 });

export const SyncChange = mongoose.model<ISyncChange>('SyncChange', SyncChangeSchema);

