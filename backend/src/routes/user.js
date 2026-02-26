const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Apply authentication middleware to all routes in this file
router.use(authenticateToken);

// Get all users (Admins, SuperAdmins, Panels, and Coordinators can view)
router.get('/', requireRole(['superadmin', 'admin', 'panel', 'coordinator']), userController.getAllUsers);

// Create a new user (Only SuperAdmin and Admin)
router.post('/', requireRole(['superadmin', 'admin']), userController.createUser);

router.post('/:userId/reset-zkp', requireRole(['superadmin', 'admin']), userController.resetZkpRegistration);

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin only.' 
      });
    }

    const users = await User.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({ 
      success: true,
      users 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch users',
      error: error.message 
    });
  }
});

// Get my assigned students (for panels)
router.get('/my-students', authenticateToken, async (req, res) => {
  try {
    console.log('📚 Getting assigned students for:', req.user.userId);

    // Only panels and admins can use this endpoint
    if (req.user.role !== 'panel' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only panels can view assigned students'
      });
    }

    // Get the current user (panel) with populated assignedStudents
    const panel = await User.findById(req.user.id)
      .populate('assignedStudents', 'name userId email matricNumber program researchTitle supervisor')
      .select('assignedStudents');

    if (!panel) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`  ✅ Found ${panel.assignedStudents?.length || 0} assigned students`);

    res.json({
      success: true,
      students: panel.assignedStudents || []
    });

  } catch (error) {
    console.error('❌ Get my students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned students',
      error: error.message
    });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({ 
      success: true,
      user 
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch user',
      error: error.message 
    });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin only.' 
      });
    }

    const { userId, name, email, role, matricNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID already exists' 
      });
    }

    const user = new User({
      userId,
      name,
      email,
      role,
      matricNumber
    });

    await user.save();

    res.status(201).json({ 
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create user',
      error: error.message 
    });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin only.' 
      });
    }

    const { name, email, role, matricNumber } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, matricNumber },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'User updated successfully',
      user 
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update user',
      error: error.message 
    });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin only.' 
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete user',
      error: error.message 
    });
  }
});

// ==================== PANEL ASSIGNMENT ENDPOINTS ====================

// Assign panel to student
router.post('/assign-panel', authenticateToken, async (req, res) => {
  try {
    const { studentId, panelId, startDate, endDate } = req.body;

    // Validate input
    if (!studentId || !panelId) {
      return res.status(400).json({ 
        success: false,
        message: 'Student ID and Panel ID are required' 
      });
    }

    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Only admins can assign panels' 
      });
    }

    // Find student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ 
        success: false,
        message: 'Student not found' 
      });
    }

    // Find panel
    const panel = await User.findById(panelId);
    if (!panel || (panel.role !== 'panel' && panel.role !== 'admin')) {
      return res.status(404).json({ 
        success: false,
        message: 'Panel member not found' 
      });
    }

    // Check if assignment already exists
    const existingAssignment = student.assignedPanels?.find(
      ap => ap.panelId.toString() === panelId
    );

    if (existingAssignment) {
      return res.status(400).json({ 
        success: false,
        message: 'This panel is already assigned to this student' 
      });
    }

    // Add to student's assignedPanels
    if (!student.assignedPanels) {
      student.assignedPanels = [];
    }
    student.assignedPanels.push({
      panelId: panelId,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null
    });
    await student.save();

    // Add to panel's assignedStudents
    if (!panel.assignedStudents) {
      panel.assignedStudents = [];
    }
    if (!panel.assignedStudents.includes(studentId)) {
      panel.assignedStudents.push(studentId);
      await panel.save();
    }

    console.log(`✅ Assigned panel ${panel.name} to student ${student.name}`);

    res.json({ 
      success: true,
      message: 'Panel assigned successfully',
      assignment: {
        student: { id: student._id, name: student.name },
        panel: { id: panel._id, name: panel.name }
      }
    });

  } catch (error) {
    console.error('❌ Assign panel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to assign panel',
      error: error.message 
    });
  }
});

// Unassign panel from student
router.post('/unassign-panel', authenticateToken, async (req, res) => {
  try {
    const { studentId, panelId } = req.body;

    // Validate input
    if (!studentId || !panelId) {
      return res.status(400).json({ 
        success: false,
        message: 'Student ID and Panel ID are required' 
      });
    }

    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Only admins can unassign panels' 
      });
    }

    // Find student and remove panel
    const student = await User.findById(studentId);
    if (student) {
      student.assignedPanels = student.assignedPanels?.filter(
        ap => ap.panelId.toString() !== panelId
      ) || [];
      await student.save();
    }

    // Find panel and remove student
    const panel = await User.findById(panelId);
    if (panel) {
      panel.assignedStudents = panel.assignedStudents?.filter(
        sid => sid.toString() !== studentId
      ) || [];
      await panel.save();
    }

    console.log(`✅ Unassigned panel from student`);

    res.json({ 
      success: true,
      message: 'Panel unassigned successfully'
    });

  } catch (error) {
    console.error('❌ Unassign panel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to unassign panel',
      error: error.message 
    });
  }
});

// Get panel assignments overview (for admin dashboard)
router.get('/assignments', authenticateToken, async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Only admins can view assignments' 
      });
    }

    // Get all students with their assigned panels
    const students = await User.find({ role: 'student' })
      .populate('assignedPanels.panelId', 'name userId email')
      .select('name userId matricNumber assignedPanels');

    // Get all panels with their assigned students
    const panels = await User.find({ role: { $in: ['panel', 'admin'] } })
      .populate('assignedStudents', 'name userId matricNumber')
      .select('name userId email assignedStudents');

    res.json({ 
      success: true,
      students,
      panels
    });

  } catch (error) {
    console.error('❌ Get assignments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message 
    });
  }
});

// Sync panel assignments (fix existing data)
router.post('/sync-assignments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Only admins can sync assignments' 
      });
    }

    console.log('🔄 Starting assignment sync...');
    const students = await User.find({ role: 'student' });
    let syncCount = 0;
    
    for (const student of students) {
      if (student.assignedPanels && student.assignedPanels.length > 0) {
        for (const assignment of student.assignedPanels) {
          const panelId = assignment.panelId;
          const panel = await User.findById(panelId);
          
          if (panel) {
            if (!panel.assignedStudents) {
              panel.assignedStudents = [];
            }
            
            const hasStudent = panel.assignedStudents.some(
              sid => sid.toString() === student._id.toString()
            );
            
            if (!hasStudent) {
              panel.assignedStudents.push(student._id);
              await panel.save();
              syncCount++;
              console.log(`  ✅ Added ${student.name} to ${panel.name}'s assignedStudents`);
            }
          }
        }
      }
    }

    console.log(`✅ Sync complete: ${syncCount} assignments synced`);

    res.json({ 
      success: true,
      message: 'Assignments synced successfully',
      syncCount
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to sync assignments',
      error: error.message 
    });
  }
});

module.exports = router;
