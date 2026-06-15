const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      required: true,
      trim: true,
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    category: {
      type: String,
      required: true,
    },
    shopId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("Product", productSchema);
