const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // or Employee model
      required: true,
    },

    month: {
      type: String, // e.g. "Jan-2026"
      required: true,
    },

    totalCases: {
      type: Number,
      default: 0,
    },

    solvedCases: {
      type: Number,
      default: 0,
    },

    performance: {
      type: Number, // percentage
      default: 0,
    },

    amountPerCase: {
      type: Number,
      default: 0,
    },

    penalty: {
      percentage: {
        type: Number,
        default: 0,
      },
      amountPerCase: {
        type: Number,
        default: 0,
      },
    },

    incentive: {
      targetDate: {
        type: Date,
      },
      action: {
        type: String, // e.g. "50%", "Completed Early"
      },
      extraPerCase: {
        type: Number,
        default: 0,
      },
    },

    incentiveSlab: {
      targetDate: {
        type: Date,
      },
      action: {
        type: String,
      },
      extraPay: {
        type: Number,
        default: 0,
      },
    },

    totalEarning: {
      type: Number,
      default: 0,
    },

    generatedPdf: {
      type: String, // store PDF URL/path
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Salary", salarySchema);