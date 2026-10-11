import mongoose, { type Document, Schema } from 'mongoose';

export type ConnectionRequestStatus = 'pending' | 'accepted' | 'declined' | 'canceled';

export interface IConnectionRequest extends Document {
  requesterId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  status: ConnectionRequestStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionRequestSchema = new Schema<IConnectionRequest>(
  {
    requesterId: {
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
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'canceled'],
      default: 'pending',
      index: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
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

ConnectionRequestSchema.index({ requesterId: 1, recipientId: 1 });
ConnectionRequestSchema.index({ recipientId: 1, status: 1 });
ConnectionRequestSchema.index({ requesterId: 1, status: 1 });

export const ConnectionRequest = mongoose.model<IConnectionRequest>(
  'ConnectionRequest',
  ConnectionRequestSchema,
);

