const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const Rubric = require('../models/Rubric');

let Evaluation, Attendance, Timetable;
try {
  Evaluation = require('../models/Evaluation');
} catch (_) {
  Evaluation = null;
}
try {
  Attendance = require('../models/Attendance');
} catch (_) {
  Attendance = null;
}
try {
  Timetable = require('../models/Timetable');
} catch (_) {
  Timetable = null;
}

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalPanels = await User.countDocuments({ role: 'panel' });

    let totalEvaluations = 0;
    let totalSessions = 0;
    let totalAttendances = 0;
    let recentEvaluations = [];
    let averageScore = 0;
    let trends = [];
    let activeRubrics = 0;

    if (Evaluation) {
      try {
        totalEvaluations = await Evaluation.countDocuments();
        const completedEvaluations = await Evaluation.find({ status: 'COMPLETED' })
          .select('studentId evaluatorId totalMarks createdAt')
          .sort({ createdAt: -1 })
          .lean();

        const scoredEvaluations = completedEvaluations.filter(
          (ev) => Number.isFinite(Number(ev.totalMarks)) && Number(ev.totalMarks) > 0,
        );
        if (scoredEvaluations.length) {
          averageScore =
            scoredEvaluations.reduce(
              (sum, ev) => sum + Number(ev.totalMarks || 0),
              0,
            ) / scoredEvaluations.length;
        }

        const monthlyStats = new Map();
        scoredEvaluations.forEach((ev) => {
          const date = new Date(ev.createdAt);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const existing = monthlyStats.get(key) || { _id: key, count: 0, totalScore: 0 };
          existing.count += 1;
          existing.totalScore += Number(ev.totalMarks || 0);
          monthlyStats.set(key, existing);
        });

        trends = [...monthlyStats.values()]
          .sort((a, b) => String(a._id).localeCompare(String(b._id)))
          .map((item) => ({
            _id: item._id,
            count: item.count,
            avgScore: item.count ? Number((item.totalScore / item.count).toFixed(2)) : 0,
          }));
        
        const evals = completedEvaluations.slice(0, 5);
        const relatedUserIds = new Set();
        evals.forEach((ev) => {
          if (ev.studentId) relatedUserIds.add(String(ev.studentId));
          if (ev.evaluatorId) relatedUserIds.add(String(ev.evaluatorId));
        });
        const relatedUsers = await User.find({ _id: { $in: [...relatedUserIds] } })
          .select('name userId')
          .lean();
        const usersById = new Map(
          relatedUsers.map((user) => [String(user._id), user]),
        );
        
        for (const ev of evals) {
          let studentName = 'Unknown';
          let panelName = 'Unknown';
          
          if (ev.studentId) {
            const student = usersById.get(String(ev.studentId));
            if (student) studentName = student.name;
          }
          
          if (ev.evaluatorId) {
            const panel = usersById.get(String(ev.evaluatorId));
            if (panel) panelName = panel.name;
          }
          
          recentEvaluations.push({
            _id: ev._id,
            student: studentName,
            panel: panelName,
            overallScore: Number(ev.totalMarks || 0),
            date: ev.createdAt,
            createdAt: ev.createdAt,
          });
        }
      } catch (error) {
        console.warn("Analytics evaluation summary fallback:", error.message);
      }
    }

    if (Timetable) {
      try {
        totalSessions = await Timetable.countDocuments();
      } catch (error) {
        console.warn("Analytics session summary fallback:", error.message);
      }
    }

    if (Attendance) {
      try {
        totalAttendances = await Attendance.countDocuments();
      } catch (error) {
        console.warn("Analytics attendance summary fallback:", error.message);
      }
    }

    try {
      activeRubrics = await Rubric.countDocuments({ isObsolete: { $ne: true } });
    } catch (error) {
      console.warn("Analytics rubric summary fallback:", error.message);
    }

    res.json({
      success: true,
      stats: {
        totalEvaluations,
        totalStudents,
        totalPanels,
        totalSessions,
        totalAttendances,
        activeRubrics,
        averageScore: Number(averageScore.toFixed(2)),
        trends,
        recentEvaluations,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message,
    });
  }
});

router.get('/student-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    let myEvaluations = [];
    let myAttendance = [];
    let upcomingSessions = [];

    if (Evaluation) {
      try {
        const evals = await Evaluation.find({ studentId: userId })
          .sort({ createdAt: -1 })
          .lean();
        
        myEvaluations = evals.map((ev) => ({
          _id: ev._id,
          sessionId: ev.sessionId,
            sessionType: ev.sessionType,
            semester: ev.semester,
            status: ev.status,
            date: ev.evaluationDate || ev.createdAt,
            createdAt: ev.createdAt,
          }));
      } catch (error) {
        console.warn("Student analytics evaluation fallback:", error.message);
      }
    }

    if (Attendance) {
      try {
        myAttendance = await Attendance.find({ studentId: userId }).lean();
      } catch (error) {
        console.warn("Student analytics attendance fallback:", error.message);
      }
    }

    if (Timetable) {
      try {
        upcomingSessions = await Timetable.find({ 
          students: userId,
          date: { $gte: new Date() }
        }).sort({ date: 1 }).limit(5).lean();
      } catch (error) {
        console.warn("Student analytics schedule fallback:", error.message);
      }
    }

    const completedSessionKeys = new Set(
      myEvaluations
        .filter((ev) => ev.status === 'COMPLETED')
        .map((ev) => String(ev.sessionId || `${ev.sessionType}_${ev.semester}`))
    );

    const presentCount = myAttendance.filter(a => a.status === 'present').length;
    const attendanceRate = myAttendance.length > 0 
      ? Math.round((presentCount / myAttendance.length) * 100) 
      : 0;

    res.json({
      success: true,
      stats: {
        totalEvaluations: completedSessionKeys.size,
        attendanceRate,
        upcomingSessions: upcomingSessions.length,
      },
    });
  } catch (error) {
    console.error("Student analytics error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student stats',
      error: error.message,
    });
  }
});

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    if (userRole === 'student') {
      return res.redirect('/api/analytics/student-stats');
    }
    return res.redirect('/api/analytics/stats');
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message,
    });
  }
});

module.exports = router;
