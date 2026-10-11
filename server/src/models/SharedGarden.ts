import mongoose, { type Document, Schema } from 'mongoose';

export interface ISharedGarden extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  plantIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const SharedGardenSchema = new Schema<ISharedGarden>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    plantIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Plant',
      },
    ],
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

export const SharedGarden = mongoose.model<ISharedGarden>('SharedGarden', SharedGardenSchema);

