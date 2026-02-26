const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Evaluation = require('../models/Evaluation');
const Timetable = require('../models/Timetable');
const Rubric = require('../models/Rubric');
const ActivityLog = require('../models/ActivityLog'); // Included your new Audit Log!

const backupDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Starting Database Backup...');

    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentBackupDir = path.join(backupDir, `backup_${timestamp}`);
    fs.mkdirSync(currentBackupDir);

    const collections = {
      users: await User.find().lean(),
      evaluations: await Evaluation.find().lean(),
      timetables: await Timetable.find().lean(),
      rubrics: await Rubric.find().lean(),
      activitylogs: await ActivityLog.find().lean()
    };

    for (const [name, data] of Object.entries(collections)) {
      fs.writeFileSync(
        path.join(currentBackupDir, `${name}.json`),
        JSON.stringify(data, null, 2)
      );
      console.log(`✅ Backed up ${data.length} records from ${name}`);
    }

    console.log(`\n🎉 Backup complete! Saved to: /backups/backup_${timestamp}`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

backupDatabase();