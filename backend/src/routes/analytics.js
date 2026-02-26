const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

// Try to load models, but handle if they don't exist
let Evaluation, Attendance, Timetable;
try {
  Evaluation = require('../models/Evaluation');
} catch (e) {
  console.log('⚠️ Evaluation model not found');
}
try {
  Attendance = require('../models/Attendance');
} catch (e) {
  console.log('⚠️ Attendance model not found');
}
try {
  Timetable = require('../models/Timetable');
} catch (e) {
  console.log('⚠️ Timetable model not found');
}

// ==========================================
// GET PANEL/ADMIN STATS
// ==========================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Analytics stats requested by:', req.user.id);

    // Get basic counts
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalPanels = await User.countDocuments({ role: 'panel' });

    let totalEvaluations = 0;
    let totalSessions = 0;
    let totalAttendances = 0;
    let recentEvaluations = [];

    // Get evaluation count if model exists
    if (Evaluation) {
      try {
        totalEvaluations = await Evaluation.countDocuments();
        
        // Get recent evaluations without populate (to avoid errors)
        const evals = await Evaluation.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        
        // Manually fetch related data
        for (const ev of evals) {
          let studentName = 'Unknown';
          let panelName = 'Unknown';
          
          // Try to get student name
          if (ev.studentId) {
            try {
              const student = await User.findById(ev.studentId).select('name userId').lean();
              if (student) studentName = student.name;
            } catch (e) {
              console.log('Could not fetch student:', ev.studentId);
            }
          }
          
          // Try to get panel name
          if (ev.panelId) {
            try {
              const panel = await User.findById(ev.panelId).select('name').lean();
              if (panel) panelName = panel.name;
            } catch (e) {
              console.log('Could not fetch panel:', ev.panelId);
            }
          }
          
          recentEvaluations.push({
            _id: ev._id,
            student: studentName,
            panel: panelName,
            overallScore: ev.overallScore || 0,
            date: ev.evaluationDate || ev.createdAt,
            createdAt: ev.createdAt
          });
        }
      } catch (error) {
        console.log('⚠️ Error fetching evaluations:', error.message);
      }
    }

    // Get session count if model exists
    if (Timetable) {
      try {
        totalSessions = await Timetable.countDocuments();
      } catch (error) {
        console.log('⚠️ Error fetching sessions:', error.message);
      }
    }

    // Get attendance count if model exists
    if (Attendance) {
      try {
        totalAttendances = await Attendance.countDocuments();
      } catch (error) {
        console.log('⚠️ Error fetching attendances:', error.message);
      }
    }

    res.json({
      success: true,
      stats: {
        totalEvaluations,
        totalStudents,
        totalPanels,
        totalSessions,
        totalAttendances,
        activeRubrics: 0,
        recentEvaluations
      }
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// ==========================================
// GET STUDENT STATS
// ==========================================
router.get('/student-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Student stats requested by:', userId);

    let myEvaluations = [];
    let myAttendance = [];
    let upcomingSessions = [];

    // Get evaluations if model exists
    if (Evaluation) {
      try {
        const evals = await Evaluation.find({ studentId: userId })
          .sort({ createdAt: -1 })
          .lean();
        
        // Manually fetch panel names
        for (const ev of evals) {
          let panelName = 'Unknown';
          
          if (ev.panelId) {
            try {
              const panel = await User.findById(ev.panelId).select('name').lean();
              if (panel) panelName = panel.name;
            } catch (e) {
              console.log('Could not fetch panel:', ev.panelId);
            }
          }
          
          myEvaluations.push({
            _id: ev._id,
            panel: panelName,
            overallScore: ev.overallScore || 0,
            feedback: ev.generalComments || 'No feedback',
            date: ev.evaluationDate || ev.createdAt,
            createdAt: ev.createdAt
          });
        }
      } catch (error) {
        console.log('⚠️ Error fetching student evaluations:', error.message);
      }
    }

    // Get attendance if model exists
    if (Attendance) {
      try {
        myAttendance = await Attendance.find({ studentId: userId }).lean();
      } catch (error) {
        console.log('⚠️ Error fetching student attendance:', error.message);
      }
    }

    // Get upcoming sessions if model exists
    if (Timetable) {
      try {
        upcomingSessions = await Timetable.find({ 
          date: { $gte: new Date() }
        }).sort({ date: 1 }).limit(5).lean();
      } catch (error) {
        console.log('⚠️ Error fetching upcoming sessions:', error.message);
      }
    }

    // Calculate average score
    const totalScore = myEvaluations.reduce((sum, ev) => sum + (ev.overallScore || 0), 0);
    const averageScore = myEvaluations.length > 0 ? totalScore / myEvaluations.length : 0;

    // Calculate attendance rate
    const presentCount = myAttendance.filter(a => a.status === 'present').length;
    const attendanceRate = myAttendance.length > 0 
      ? Math.round((presentCount / myAttendance.length) * 100) 
      : 0;

    res.json({
      success: true,
      stats: {
        totalEvaluations: myEvaluations.length,
        averageScore: Math.round(averageScore * 10) / 10,
        attendanceRate,
        upcomingSessions: upcomingSessions.length,
        recentFeedback: myEvaluations.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('❌ Student analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student stats',
      error: error.message
    });
  }
});

// ==========================================
// GET DASHBOARD STATS (Generic)
// ==========================================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    if (userRole === 'student') {
      // Redirect to student stats
      return res.redirect('/api/analytics/student-stats');
    } else {
      // Redirect to panel/admin stats
      return res.redirect('/api/analytics/stats');
    }

  } catch (error) {
    console.error('❌ Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
});

module.exports = router;
