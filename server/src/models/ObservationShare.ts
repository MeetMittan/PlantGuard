import mongoose, { type Document, Schema } from 'mongoose';

export interface IObservationShare extends Document {
  observationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  canComment: boolean;
  notes?: string;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ObservationShareSchema = new Schema<IObservationShare>(
  {
    observationId: {
      type: Schema.Types.ObjectId,
      ref: 'Observation',
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    canComment: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    revokedAt: {
      type: Date,
      default: null,
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

ObservationShareSchema.index({ observationId: 1, recipientId: 1 }, { unique: true });
ObservationShareSchema.index({ recipientId: 1, revokedAt: 1 });
ObservationShareSchema.index({ ownerId: 1, revokedAt: 1 });

export const ObservationShare = mongoose.model<IObservationShare>(
  'ObservationShare',
  ObservationShareSchema,
);

