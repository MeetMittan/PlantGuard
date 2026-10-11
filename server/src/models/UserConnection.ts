import mongoose, { type Document, Schema } from 'mongoose';

export type UserConnectionStatus = 'connected' | 'blocked';

export interface IUserConnection extends Document {
  user1Id: mongoose.Types.ObjectId;
  user2Id: mongoose.Types.ObjectId;
  status: UserConnectionStatus;
  blockedById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserConnectionSchema = new Schema<IUserConnection>(
  {
    user1Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user2Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['connected', 'blocked'],
      default: 'connected',
      index: true,
    },
    blockedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

UserConnectionSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
UserConnectionSchema.index({ user1Id: 1, status: 1 });
UserConnectionSchema.index({ user2Id: 1, status: 1 });

/**
 * Helper to ensure canonical ordering of pair IDs (user1Id < user2Id)
 */
export function getCanonicalPair(idA: mongoose.Types.ObjectId | string, idB: mongoose.Types.ObjectId | string) {
  const strA = idA.toString();
  const strB = idB.toString();
  if (strA < strB) {
    return {
      user1Id: new mongoose.Types.ObjectId(strA),
      user2Id: new mongoose.Types.ObjectId(strB),
    };
  }
  return {
    user1Id: new mongoose.Types.ObjectId(strB),
    user2Id: new mongoose.Types.ObjectId(strA),
  };
}

export const UserConnection = mongoose.model<IUserConnection>('UserConnection', UserConnectionSchema);

