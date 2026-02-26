const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Rubric = require('../models/Rubric');

router.use(authenticateToken);

// @desc    Get all rubrics
// @route   GET /api/rubrics
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const rubrics = await Rubric.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: rubrics.length,
      rubrics,
    });
  } catch (error) {
    console.error('Get rubrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rubrics',
    });
  }
});

// @desc    Get single rubric
// @route   GET /api/rubrics/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: 'Rubric not found',
      });
    }

    res.json({
      success: true,
      rubric,
    });
  } catch (error) {
    console.error('Get rubric error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rubric',
    });
  }
});

// @desc    Create rubric
// @route   POST /api/rubrics
// @access  Private (Admin, Panel - check in controller or here)
router.post('/', async (req, res) => {
  try {
    // Role check
    if (req.user.role !== 'admin' && req.user.role !== 'panel') {
      return res.status(403).json({
        success: false,
        message: 'Only admins and panels can create rubrics'
      });
    }

    console.log('📝 Creating rubric:', req.body.name);

    const rubricData = {
      ...req.body,
      createdBy: req.user.id,
    };

    const rubric = await Rubric.create(rubricData);

    console.log('✅ Rubric created:', rubric._id);

    const populated = await Rubric.findById(rubric._id)
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      rubric: populated,
    });
  } catch (error) {
    console.error('Create rubric error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating rubric',
      error: error.message,
    });
  }
});

// @desc    Update rubric
// @route   PUT /api/rubrics/:id
// @access  Private (Admin, Panel)
router.put('/:id', async (req, res) => {
  try {
    // Role check
    if (req.user.role !== 'admin' && req.user.role !== 'panel') {
      return res.status(403).json({
        success: false,
        message: 'Only admins and panels can update rubrics'
      });
    }

    console.log('📝 Updating rubric:', req.params.id);

    const rubric = await Rubric.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: 'Rubric not found',
      });
    }

    console.log('✅ Rubric updated');

    res.json({
      success: true,
      rubric,
    });
  } catch (error) {
    console.error('Update rubric error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating rubric',
      error: error.message,
    });
  }
});

// @desc    Delete rubric
// @route   DELETE /api/rubrics/:id
// @access  Private (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    // Role check
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete rubrics'
      });
    }

    console.log('🗑️ Deleting rubric:', req.params.id);

    const rubric = await Rubric.findByIdAndDelete(req.params.id);

    if (!rubric) {
      return res.status(404).json({
        success: false,
        message: 'Rubric not found',
      });
    }

    console.log('✅ Rubric deleted');

    res.json({
      success: true,
      message: 'Rubric deleted successfully',
    });
  } catch (error) {
    console.error('Delete rubric error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting rubric',
    });
  }
});

module.exports = router;
