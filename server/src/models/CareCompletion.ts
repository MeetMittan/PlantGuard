import mongoose, { type Document, Schema } from 'mongoose';

export interface ICareCompletion extends Document {
  ownerId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  completedDate: string; // YYYY-MM-DD
  notes?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CareCompletionSchema = new Schema<ICareCompletion>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'CareTask',
      required: true,
      index: true,
    },
    completedDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
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

CareCompletionSchema.index({ ownerId: 1, taskId: 1, completedDate: 1 }, { unique: true });
CareCompletionSchema.index({ ownerId: 1, completedDate: -1 });

export const CareCompletion = mongoose.model<ICareCompletion>('CareCompletion', CareCompletionSchema);

