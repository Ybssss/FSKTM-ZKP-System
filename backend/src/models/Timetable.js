const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    sessionType: {
      type: String,
      required: true,
    },
    rubricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rubric",
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    venue: {
      type: String,
      required: true,
    },
    googleMeetLink: {
      type: String,
      default: "",
    },

    batchName: {
      type: String,
      default: "",
    },

    batchId: {
      type: String,
      default: "",
      index: true,
    },

    slotDurationMinutes: {
      type: Number,
      default: null,
    },

    breakBetweenSlotsMinutes: {
      type: Number,
      default: 5,
    },
    deadline: {
      type: Date,
    },
    requirements: {
      type: String,
    },
    attachmentUrl: {
      type: String,
    },
    qrCode: {
      type: String,
      default: "",
    },

    qrExpiresAt: {
      type: Date,
      default: null,
    },

    qrGeneratedAt: {
      type: Date,
      default: null,
    },
    // NEW: Student Documents for Pre-Review
    studentDocuments: [
      {
        title: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        driveFileId: {
          type: String,
        },
        mimeType: {
          type: String,
        },
        source: {
          type: String,
          enum: ["google-drive", "external-link"],
          default: "google-drive",
        },
        type: {
          type: String,
          enum: ["report", "slides", "supplementary", "other"],
          default: "other",
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        fileSize: String,
        description: String,
      },
    ],

    // NEW: Panel Pre-Review Notes
    panelNotes: [
      {
        panelId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        notes: {
          type: String,
          required: true,
        },
        isDraft: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    panels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "cancelled"],
      default: "scheduled",
    },
    qrGenerated: {
      type: Boolean,
      default: false,
    },
    remarks: [
      {
        panelId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Timetable", timetableSchema);
