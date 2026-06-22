import { Schema, model } from "mongoose";

const TEN_YEARS_MS = 10 * 365.25 * 24 * 60 * 60 * 1000;

const pushTokenSchema = new Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    fcmToken: { type: String, required: true, trim: true, unique: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + TEN_YEARS_MS),
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

pushTokenSchema.index({ userId: 1, active: 1 });
pushTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PushToken = model("PushToken", pushTokenSchema);
