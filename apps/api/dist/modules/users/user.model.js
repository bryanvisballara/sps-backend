import { Schema, model } from "mongoose";
const userSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["sales-rep-aruba", "warehouse-aruba", "colombia-ops", "management"],
        required: true,
    },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const User = model("User", userSchema);
//# sourceMappingURL=user.model.js.map