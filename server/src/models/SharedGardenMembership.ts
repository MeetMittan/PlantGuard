import mongoose, { type Document, Schema } from 'mongoose';

export type SharedGardenRole = 'viewer' | 'contributor' | 'admin';

export interface ISharedGardenMembership extends Document {
  gardenId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: SharedGardenRole;
  createdAt: Date;
  updatedAt: Date;
}

const SharedGardenMembershipSchema = new Schema<ISharedGardenMembership>(
  {
    gardenId: {
      type: Schema.Types.ObjectId,
      ref: 'SharedGarden',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['viewer', 'contributor', 'admin'],
      default: 'viewer',
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

SharedGardenMembershipSchema.index({ gardenId: 1, userId: 1 }, { unique: true });
SharedGardenMembershipSchema.index({ userId: 1 });

export const SharedGardenMembership = mongoose.model<ISharedGardenMembership>(
  'SharedGardenMembership',
  SharedGardenMembershipSchema,
);
