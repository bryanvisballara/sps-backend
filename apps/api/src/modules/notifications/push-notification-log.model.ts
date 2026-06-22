import { Schema, model } from "mongoose";

const pushNotificationLogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    kind: { type: String, required: true, trim: true },
    sentAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

export const PushNotificationLog = model("PushNotificationLog", pushNotificationLogSchema);
