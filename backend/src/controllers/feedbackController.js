const Evaluation = require('../models/Evaluation');
const User = require('../models/User');

// @desc    Search feedback/evaluations
// @route   GET /api/feedback/search
// @access  Private
exports.searchFeedback = async (req, res) => {
  try {
    const { query, semester, studentId } = req.query;

    console.log('🔍 Searching feedback:', { query, semester, studentId });

    const filter = {};

    // Search by student name or matric number
    if (query && query.trim() !== '') {
      const students = await User.find({
        role: 'student',
        $or: [
          { name: new RegExp(query, 'i') },
          { matricNumber: new RegExp(query, 'i') },
          { userId: new RegExp(query, 'i') },
        ],
      }).select('_id');

      if (students.length > 0) {
        filter.studentId = { $in: students.map(s => s._id) };
      } else {
        // No students found matching query
        console.log('⚠️  No students found matching query');
        return res.json({
          success: true,
          count: 0,
          evaluations: [],
        });
      }
    }

    // Filter by semester
    if (semester && semester.trim() !== '') {
      filter.semester = semester;
    }

    // Filter by specific student
    if (studentId && studentId.trim() !== '') {
      filter.studentId = studentId;
    }

    console.log('📊 Search filter:', JSON.stringify(filter, null, 2));

    const evaluations = await Evaluation.find(filter)
      .populate('studentId', 'name matricNumber program email')
      .populate('evaluatorId', 'name email')
      .populate('rubricId', 'name')
      .sort({ date: -1 });

    console.log(`✅ Found ${evaluations.length} evaluations`);

    res.json({
      success: true,
      count: evaluations.length,
      evaluations,
    });
  } catch (error) {
    console.error('❌ Search feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching feedback',
      error: error.message,
    });
  }
};

// @desc    Get all unique semesters
// @route   GET /api/feedback/semesters
// @access  Private
exports.getSemesters = async (req, res) => {
  try {
    console.log('📅 Fetching all semesters');

    const semesters = await Evaluation.distinct('semester');

    console.log(`✅ Found ${semesters.length} semesters`);

    res.json({
      success: true,
      count: semesters.length,
      semesters: semesters.sort(),
    });
  } catch (error) {
    console.error('❌ Get semesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching semesters',
      error: error.message,
    });
  }
};

// @desc    Get feedback statistics
// @route   GET /api/feedback/stats
// @access  Private
exports.getFeedbackStats = async (req, res) => {
  try {
    const { studentId, semester } = req.query;

    console.log('📊 Calculating feedback statistics');

    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (semester) filter.semester = semester;

    const total = await Evaluation.countDocuments(filter);
    
    const avgScoreResult = await Evaluation.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$overallScore' },
          minScore: { $min: '$overallScore' },
          maxScore: { $max: '$overallScore' },
        },
      },
    ]);

    const stats = {
      total,
      averageScore: avgScoreResult.length > 0 
        ? Math.round(avgScoreResult[0].averageScore * 10) / 10 
        : 0,
      minScore: avgScoreResult.length > 0 ? avgScoreResult[0].minScore : 0,
      maxScore: avgScoreResult.length > 0 ? avgScoreResult[0].maxScore : 0,
    };

    console.log('✅ Statistics calculated:', stats);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating statistics',
      error: error.message,
    });
  }
};

// @desc    Get recent feedback
// @route   GET /api/feedback/recent
// @access  Private
exports.getRecentFeedback = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log('🔍 Fetching recent feedback');

    const evaluations = await Evaluation.find()
      .populate('studentId', 'name matricNumber')
      .populate('evaluatorId', 'name')
      .populate('rubricId', 'name')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    console.log(`✅ Found ${evaluations.length} recent evaluations`);

    res.json({
      success: true,
      count: evaluations.length,
      evaluations,
    });
  } catch (error) {
    console.error('❌ Get recent feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent feedback',
      error: error.message,
    });
  }
};
