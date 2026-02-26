const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env (Go up two folders from src/scripts)
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import Models
const User = require('../models/User');
const Rubric = require('../models/Rubric');
const Timetable = require('../models/Timetable');
const Evaluation = require('../models/Evaluation');
const Attendance = require('../models/Attendance');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting comprehensive database seeding...');

    // Check if MONGO_URI is loaded
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI not found in .env file!');
      console.error('Make sure .env file exists in backend/ directory');
      process.exit(1);
    }

    console.log('📍 Connecting to:', process.env.MONGO_URI);

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Rubric.deleteMany({});
    await Timetable.deleteMany({});
    await Evaluation.deleteMany({});
    await Attendance.deleteMany({});
    console.log('✅ Existing data cleared');

    // ==========================================
    // CREATE USERS
    // ==========================================
    console.log('\n👥 Creating users with First-Time Registration Codes...');

    const users = [];

    // 1. SUPER ADMIN
    const superAdmin = await User.create({
      userId: 'SUP001',
      name: 'System Grandmaster',
      email: 'superadmin@uthm.edu.my',
      role: 'superadmin',
      registrationCode: 'SUPER-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(superAdmin);
    console.log(`✅ Created Super Admin: ${superAdmin.name} (Code: SUPER-123)`);

    // 2. ADMIN (PIC)
    const admin = await User.create({
      userId: 'ADMIN001',
      name: 'Dr. Hassan Abdullah',
      email: 'hassan@uthm.edu.my',
      role: 'admin',
      registrationCode: 'ADMIN-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(admin);
    console.log(`✅ Created Admin: ${admin.name} (Code: ADMIN-123)`);

    // 3. DEDICATED SUPERVISOR
    const supervisor1 = await User.create({
      userId: 'SVR001',
      name: 'Prof. Data Analysis',
      email: 'data@uthm.edu.my',
      role: 'supervisor',
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(supervisor1);
    console.log(`✅ Created Supervisor: ${supervisor1.name}`);

    // 4. PANEL MEMBERS
    const panel1 = await User.create({
      userId: 'PANEL001',
      name: 'Dr. Rahman Ahmad',
      email: 'rahman@uthm.edu.my',
      role: 'panel',
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(panel1);

    const panel2 = await User.create({
      userId: 'PANEL002',
      name: 'Dr. Siti Aminah',
      email: 'siti@uthm.edu.my',
      role: 'panel',
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(panel2);

    const panel3 = await User.create({
      userId: 'PANEL003',
      name: 'Dr. Kumar Raj',
      email: 'kumar@uthm.edu.my',
      role: 'panel',
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(panel3);

    console.log(`✅ Created 3 panel members`);

    // 5. STUDENTS
    const student1 = await User.create({
      userId: 'STU001',
      name: 'Ahmad Ibrahim',
      email: 'ahmad@student.uthm.edu.my',
      matricNumber: 'AI230001',
      role: 'student',
      program: 'PhD Computer Science',
      researchTitle: 'Machine Learning for Healthcare Applications',
      supervisorId: panel1._id, 
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(student1);

    const student2 = await User.create({
      userId: 'STU002',
      name: 'Nurul Huda Bt. Hassan',
      email: 'nurul@student.uthm.edu.my',
      matricNumber: 'NH230002',
      role: 'student',
      program: 'Master Computer Science',
      researchTitle: 'Deep Learning for Image Recognition',
      supervisorId: panel2._id, 
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(student2);

    const student3 = await User.create({
      userId: 'STU003',
      name: 'Wong Wei Jian',
      email: 'wong@student.uthm.edu.my',
      matricNumber: 'WW230003',
      role: 'student',
      program: 'PhD Information Technology',
      researchTitle: 'Blockchain Technology for Supply Chain Management',
      supervisorId: panel3._id, 
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(student3);

    const student4 = await User.create({
      userId: 'STU004',
      name: 'Fatimah Zahra',
      email: 'fatimah@student.uthm.edu.my',
      matricNumber: 'FZ230004',
      role: 'student',
      program: 'Master Information Technology',
      researchTitle: 'IoT Security in Smart Home Systems',
      supervisorId: panel1._id, 
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(student4);

    const student5 = await User.create({
      userId: 'STU005',
      name: 'Lee Chong Wei',
      email: 'lee@student.uthm.edu.my',
      matricNumber: 'LCW230005',
      role: 'student',
      program: 'PhD Software Engineering',
      researchTitle: 'Agile Methodologies in Large-Scale Projects',
      supervisorId: panel2._id, 
      registrationCode: 'TEST-123',
      zkpRegistered: false,
      isActive: true,
    });
    users.push(student5);

    // ==========================================
    // ASSIGN PANELS TO STUDENTS
    // ==========================================
    console.log('\n👥 Assigning panels to students...');

    student1.assignedPanels = [{ panelId: panel1._id, startDate: new Date('2024-01-01'), endDate: null }];
    await student1.save();
    panel1.assignedStudents = [student1._id, student4._id];
    await panel1.save();
    
    student4.assignedPanels = [{ panelId: panel1._id, startDate: new Date('2024-01-01'), endDate: null }];
    await student4.save();

    student2.assignedPanels = [{ panelId: panel2._id, startDate: new Date('2024-02-01'), endDate: null }];
    await student2.save();
    panel2.assignedStudents = [student2._id, student5._id];
    await panel2.save();

    student5.assignedPanels = [{ panelId: panel2._id, startDate: new Date('2024-02-01'), endDate: null }];
    await student5.save();

    student3.assignedPanels = [{ panelId: panel3._id, startDate: new Date('2024-03-01'), endDate: null }];
    await student3.save();
    panel3.assignedStudents = [student3._id];
    await panel3.save();

    // Co-supervisor example
    student1.assignedPanels.push({ panelId: panel2._id, startDate: new Date('2024-08-01'), endDate: null });
    await student1.save();
    panel2.assignedStudents.push(student1._id);
    await panel2.save();

    console.log(`✅ Panel assignments completed`);

    // ==========================================
    // CREATE RUBRICS
    // ==========================================
    console.log('\n📋 Creating rubrics...');

    const rubric1 = await Rubric.create({
      name: 'PhD Progress Review',
      description: 'Comprehensive evaluation rubric for PhD student progress reviews',
      criteria: [
        { name: 'Research Progress', description: 'Overall progress in research activities', weight: 30, maxScore: 100 },
        { name: 'Literature Review', description: 'Quality and depth of literature review', weight: 20, maxScore: 100 },
        { name: 'Methodology', description: 'Appropriateness and rigor of research methodology', weight: 25, maxScore: 100 },
        { name: 'Data Analysis', description: 'Quality of data collection and analysis', weight: 15, maxScore: 100 },
        { name: 'Presentation Skills', description: 'Clarity and effectiveness of presentation', weight: 10, maxScore: 100 },
      ],
      createdBy: admin._id,
      isActive: true,
    });

    const rubric2 = await Rubric.create({
      name: 'Master Progress Review',
      description: 'Evaluation rubric for Master student progress reviews',
      criteria: [
        { name: 'Research Progress', description: 'Progress in research activities and milestones', weight: 35, maxScore: 100 },
        { name: 'Literature Review', description: 'Coverage and understanding of relevant literature', weight: 25, maxScore: 100 },
        { name: 'Methodology', description: 'Research design and methods', weight: 20, maxScore: 100 },
        { name: 'Presentation & Communication', description: 'Presentation clarity and Q&A performance', weight: 20, maxScore: 100 },
      ],
      createdBy: admin._id,
      isActive: true,
    });

    const rubric3 = await Rubric.create({
      name: 'Proposal Defense',
      description: 'Evaluation rubric for research proposal defense',
      criteria: [
        { name: 'Problem Statement', description: 'Clarity and significance of research problem', weight: 20, maxScore: 100 },
        { name: 'Literature Review', description: 'Comprehensiveness of literature review', weight: 20, maxScore: 100 },
        { name: 'Research Objectives', description: 'Clear and achievable research objectives', weight: 15, maxScore: 100 },
        { name: 'Methodology', description: 'Soundness of proposed methodology', weight: 25, maxScore: 100 },
        { name: 'Expected Outcomes', description: 'Clarity of expected results and contributions', weight: 10, maxScore: 100 },
        { name: 'Defense Performance', description: 'Quality of presentation and responses to questions', weight: 10, maxScore: 100 },
      ],
      createdBy: admin._id,
      isActive: true,
    });
    console.log(`✅ Created 3 standard rubrics`);

    // ==========================================
    // CREATE TIMETABLES (SESSIONS)
    // ==========================================
    console.log('\n📅 Creating sessions...');

    const session1 = await Timetable.create({
      sessionType: 'Progress Review #1',
      title: 'Progress Review #1 - Ahmad Ibrahim',
      description: 'First progress review presentation for ML Healthcare research',
      date: new Date('2024-06-15'),
      startTime: '14:00',
      endTime: '16:00',
      venue: 'Seminar Room A',
      deadline: new Date('2024-06-10'),
      requirements: '- Research progress report\n- Presentation slides',
      students: [student1._id],
      panels: [panel1._id],
      status: 'completed',
      createdBy: panel1._id,
    });

    const session2 = await Timetable.create({
      sessionType: 'Progress Review #2',
      title: 'Progress Review #2 - Fatimah Zahra',
      description: 'Second progress review for IoT Security research',
      date: new Date('2025-01-25'),
      startTime: '10:00',
      endTime: '12:00',
      venue: 'Conference Room B',
      students: [student4._id],
      panels: [panel1._id],
      status: 'scheduled',
      createdBy: panel1._id,
    });

    const session3 = await Timetable.create({
      sessionType: 'Proposal Defense',
      title: 'Proposal Defense - Nurul Huda',
      date: new Date('2025-01-28'),
      startTime: '14:00',
      endTime: '16:00',
      venue: 'Dewan Kuliah 1',
      students: [student2._id],
      panels: [panel2._id],
      status: 'scheduled',
      createdBy: panel2._id,
    });

    const session4 = await Timetable.create({
      sessionType: 'Mid-term Presentation',
      title: 'Mid-term Presentation - Wong Wei Jian',
      date: new Date('2024-11-20'),
      startTime: '09:00',
      endTime: '11:00',
      venue: 'Lab 3',
      students: [student3._id],
      panels: [panel3._id],
      status: 'completed',
      createdBy: panel3._id,
    });

    const session5 = await Timetable.create({
      sessionType: 'Progress Review #3',
      title: 'Progress Review #3 - Lee Chong Wei',
      date: new Date(),
      startTime: '13:00',
      endTime: '15:00',
      venue: 'Meeting Room 2',
      students: [student5._id],
      panels: [panel2._id],
      status: 'ongoing',
      createdBy: panel2._id,
    });

    console.log(`✅ Created 5 sessions total`);

    // ==========================================
    // CREATE EVALUATIONS
    // ==========================================
    console.log('\n📊 Creating evaluations...');

    await Evaluation.create({
      studentId: student1._id, evaluatorId: panel1._id, rubricId: rubric1._id,
      semester: 'Semester 1 2024/2025', // <-- ADDED THIS BACK
      sessionType: 'Progress Review #1',
      scores: { [rubric1.criteria[0]._id]: 85, [rubric1.criteria[1]._id]: 80, [rubric1.criteria[2]._id]: 88, [rubric1.criteria[3]._id]: 75, [rubric1.criteria[4]._id]: 90 },
      overallScore: 84.2, remarks: 'Excellent progress in ML algorithms.'
    });

    await Evaluation.create({
      studentId: student1._id, evaluatorId: panel2._id, rubricId: rubric1._id,
      semester: 'Semester 2 2024/2025', // <-- ADDED THIS BACK
      sessionType: 'Progress Review #2',
      scores: { [rubric1.criteria[0]._id]: 88, [rubric1.criteria[1]._id]: 85, [rubric1.criteria[2]._id]: 90, [rubric1.criteria[3]._id]: 82, [rubric1.criteria[4]._id]: 87 },
      overallScore: 86.5, remarks: 'Significant improvement since last review.'
    });

    await Evaluation.create({
      studentId: student3._id, evaluatorId: panel3._id, rubricId: rubric1._id,
      semester: 'Semester 1 2024/2025', // <-- ADDED THIS BACK
      sessionType: 'Mid-term Presentation',
      scores: { [rubric1.criteria[0]._id]: 90, [rubric1.criteria[1]._id]: 88, [rubric1.criteria[2]._id]: 92, [rubric1.criteria[3]._id]: 87, [rubric1.criteria[4]._id]: 85 },
      overallScore: 88.7, remarks: 'Outstanding implementation of blockchain system.'
    });

    console.log(`✅ Created evaluation records`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ENTERPRISE DATABASE SEEDING COMPLETED! 🎉');
    console.log('='.repeat(80));
    console.log('\n🔑 IMPORTANT - FIRST TIME SETUP:');
    console.log('You MUST use the Registration Page to bind these accounts to your device first!');
    console.log('\n🛡️ HIGH PRIVILEGE ACCOUNTS:');
    console.log('   • Super Admin | ID: SUP001    | Code: SUPER-123');
    console.log('   • Admin (PIC) | ID: ADMIN001  | Code: ADMIN-123');
    
    console.log('\n👨‍🏫 FACULTY ACCOUNTS (Code: TEST-123):');
    console.log('   • SVR001 (Supervisor)');
    console.log('   • PANEL001 (Panel)');
    console.log('   • PANEL002 (Panel)');
    console.log('   • PANEL003 (Panel)');
    
    console.log('\n🎓 STUDENT ACCOUNTS (Code: TEST-123):');
    console.log('   • STU001, STU002, STU003, STU004, STU005');

    console.log('\n✨ TEST SCENARIO:');
    console.log('   1. Register SUP001 via frontend (Requires code SUPER-123).');
    console.log('   2. Log in as SUP001.');
    console.log('   3. Go to User Management -> Create a new Admin or Panel.');
    console.log('   4. Check out the automated Code Generation Popup!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Seeding error:', error);
    if (error.stack) console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
};

seedDatabase();