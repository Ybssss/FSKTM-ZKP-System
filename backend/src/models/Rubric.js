const mongoose = require('mongoose');

const rubricSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  criteria: [{
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    maxScore: {
      type: Number,
      default: 100,
    },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Validate that criteria weights sum to 100
rubricSchema.pre('save', function(next) {
  if (this.criteria && this.criteria.length > 0) {
    const totalWeight = this.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      return next(new Error(`Criteria weights must sum to 100%. Current total: ${totalWeight}%`));
    }
  }
  next();
});

// Index for faster queries
rubricSchema.index({ isActive: 1 });
rubricSchema.index({ name: 1 });

module.exports = mongoose.model('Rubric', rubricSchema);
