const mongoose = require('mongoose');
require('dotenv').config();

// Import models - CORRECT PATH!
const User = require('../models/User');
const Evaluation = require('../models/Evaluation');
const Rubric = require('../models/Rubric');
const Timetable = require('../models/Timetable');

async function createTestData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📦 Loading existing data...');
    
    // Get existing users and rubric
    const student = await User.findOne({ role: 'student' });
    const panel = await User.findOne({ role: 'panel' });
    const rubric = await Rubric.findOne();

    if (!student) {
      console.error('❌ No student found. Please run seed script first.');
      process.exit(1);
    }
    if (!panel) {
      console.error('❌ No panel member found. Please run seed script first.');
      process.exit(1);
    }
    if (!rubric) {
      console.error('❌ No rubric found. Please run seed script first.');
      process.exit(1);
    }

    console.log(`✅ Found student: ${student.name}`);
    console.log(`✅ Found panel: ${panel.name}`);
    console.log(`✅ Found rubric: ${rubric.name}`);

    console.log('\n🎯 Generating test evaluations...');

    // Delete existing test evaluations (optional - for clean slate)
    await Evaluation.deleteMany({ studentId: student._id });
    console.log('🗑️  Cleared old evaluations for this student');

    // Generate 5 evaluations showing progress
    const evaluations = [];
    const dates = [
      new Date('2024-08-15'),
      new Date('2024-09-20'),
      new Date('2024-10-25'),
      new Date('2024-11-20'),
      new Date('2024-12-15'),
    ];

    const sessionTypes = [
      'Proposal Defense',
      'Progress Review #1',
      'Progress Review #2',
      'Progress Review #3',
      'Mock Defense',
    ];

    const baseScores = [68, 74, 79, 84, 88]; // Showing improvement

    for (let i = 0; i < dates.length; i++) {
      console.log(`\n📝 Creating evaluation ${i + 1}/${dates.length}...`);
      
      const criteria = rubric.criteria.map((c, idx) => {
        const variance = Math.floor(Math.random() * 10) - 5; // -5 to +5
        const score = Math.min(100, Math.max(0, baseScores[i] + variance));
        
        const comments = [
          `Strong understanding demonstrated. ${i >= 3 ? 'Excellent progress!' : 'Keep developing this area.'}`,
          `Good grasp of concepts. ${i >= 2 ? 'Shows significant improvement.' : 'More depth needed.'}`,
          `Clear presentation. ${i >= 3 ? 'Well-structured and thorough.' : 'Consider adding more examples.'}`,
          `Methodology is sound. ${i >= 2 ? 'Well-executed approach.' : 'Needs refinement.'}`,
          `Results are promising. ${i >= 3 ? 'Comprehensive analysis.' : 'Expand on findings.'}`,
        ];
        
        return {
          name: c.name,
          weight: c.weight,
          score: score,
          comments: comments[idx % comments.length],
        };
      });

      const overallScore = criteria.reduce((sum, c) => sum + (c.score * c.weight / 100), 0);

      const evaluation = await Evaluation.create({
        studentId: student._id,
        evaluatorId: panel._id,
        semester: 'Semester 1, 2024/2025',
        sessionType: sessionTypes[i],
        date: dates[i],
        rubricId: rubric._id,
        criteria: criteria,
        overallScore: Math.round(overallScore),
        overallComments: i === dates.length - 1
          ? 'Outstanding progress throughout the semester! Research is well-developed and presentation skills have improved significantly. Ready for final defense preparation.'
          : `Good work on ${sessionTypes[i]}. ${i >= 2 ? 'Showing consistent improvement.' : 'Continue developing your research methodology.'} Focus on addressing the feedback provided.`,
        recommendations: i === dates.length - 1
          ? 'Prepare comprehensive defense slides. Review all previous feedback. Practice Q&A session with supervisor.'
          : `Focus on ${rubric.criteria[i % rubric.criteria.length].name.toLowerCase()} for next presentation. Review literature in more depth.`,
        zkpSignature: `signature_${Date.now()}_${i}`,
        status: 'completed',
      });

      evaluations.push(evaluation);
      console.log(`   ✅ ${sessionTypes[i]} - Score: ${Math.round(overallScore)}`);
    }

    console.log('\n📅 Generating timetable entries...');

    // Clear old timetable entries (optional)
    await Timetable.deleteMany({ studentId: student._id });
    console.log('🗑️  Cleared old timetable entries');

    // Create future timetable entry
    const futureTimetable = await Timetable.create({
      studentId: student._id,
      sessionType: 'Final Defense',
      date: new Date('2025-01-20'),
      startTime: '10:00 AM',
      endTime: '12:00 PM',
      venue: 'Seminar Room A, Block C',
      panelMembers: [panel._id],
      status: 'scheduled',
      notes: 'Final defense presentation. Please prepare 30-minute presentation followed by Q&A.',
    });

    console.log('   ✅ Final Defense (scheduled)');

    // Create past timetable entries
    for (let i = 0; i < 3; i++) {
      await Timetable.create({
        studentId: student._id,
        sessionType: sessionTypes[i],
        date: dates[i],
        startTime: '2:00 PM',
        endTime: '4:00 PM',
        venue: `Seminar Room ${String.fromCharCode(65 + i)}, Block C`,
        panelMembers: [panel._id],
        status: 'completed',
      });
      console.log(`   ✅ ${sessionTypes[i]} (completed)`);
    }

    console.log('\n🎉 Test data generation complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ ${evaluations.length} evaluations created`);
    console.log(`   ✅ 4 timetable entries created`);
    console.log(`   📈 Score progression: ${baseScores[0]} → ${baseScores[baseScores.length - 1]}`);
    console.log(`\n💡 Login as student to see the data:`);
    console.log(`   User ID: ${student.userId}`);
    console.log(`   Password: student123`);

  } catch (error) {
    console.error('\n❌ Error generating test data:', error);
    console.error('Error details:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the function
createTestData();