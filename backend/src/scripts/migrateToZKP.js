/**
 * Migration Script: Add ZKP Fields to Existing Users
 * Run: node backend/src/scripts/migrateToZKP.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/fsktm-zkp';
    console.log('🔌 Connecting to MongoDB...');
    console.log('   URI:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// User Schema (minimal for migration)
const userSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  role: String,
  zkpPublicKey: String,
  zkpRegistered: Boolean,
  zkpChallenge: String,
  zkpChallengeExpiry: Date,
  authenticatedDevices: [{
    deviceId: String,
    deviceName: String,
    userAgent: String,
    ipAddress: String,
    trustStatus: Boolean,
    lastLogin: Date,
    registeredAt: Date,
    isActive: Boolean,
  }],
}, { strict: false, timestamps: true });

const User = mongoose.model('User', userSchema);

// Migration function
const migrateUsers = async () => {
  try {
    console.log('🔄 Starting ZKP Migration...\n');

    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        let needsUpdate = false;
        const updates = {};

        // Check and add zkpRegistered field
        if (user.zkpRegistered === undefined) {
          // If user has zkpPublicKey, they're registered
          updates.zkpRegistered = !!user.zkpPublicKey;
          needsUpdate = true;
        }

        // Check and add zkpChallenge field
        if (user.zkpChallenge === undefined) {
          updates.zkpChallenge = null;
          needsUpdate = true;
        }

        // Check and add zkpChallengeExpiry field
        if (user.zkpChallengeExpiry === undefined) {
          updates.zkpChallengeExpiry = null;
          needsUpdate = true;
        }

        // Check and add authenticatedDevices field
        if (!user.authenticatedDevices || user.authenticatedDevices.length === 0) {
          if (!Array.isArray(user.authenticatedDevices)) {
            updates.authenticatedDevices = [];
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await User.updateOne(
            { _id: user._id },
            { $set: updates }
          );
          
          console.log(`✅ Updated: ${user.userId} (${user.name})`);
          console.log(`   Added: ${Object.keys(updates).join(', ')}`);
          updated++;
        } else {
          console.log(`⏭️  Skipped: ${user.userId} (already has all fields)`);
          skipped++;
        }

      } catch (error) {
        console.error(`❌ Error updating ${user.userId}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Updated: ${updated} users`);
    console.log(`⏭️  Skipped: ${skipped} users`);
    console.log(`❌ Errors:  ${errors} users`);
    console.log('='.repeat(50) + '\n');

    // Show final status
    console.log('📋 Final User Status:\n');
    const finalUsers = await User.find({}).select('userId name zkpRegistered zkpPublicKey authenticatedDevices');
    
    for (const user of finalUsers) {
      const status = user.zkpRegistered ? '✅' : '⚠️';
      const hasKey = user.zkpPublicKey ? '🔑' : '❌';
      const devices = user.authenticatedDevices?.length || 0;
      
      console.log(`${status} ${user.userId.padEnd(12)} | ${hasKey} Key: ${user.zkpPublicKey ? 'YES' : 'NO'} | 📱 Devices: ${devices}`);
    }

    console.log('\n✅ Migration Complete!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await migrateUsers();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

main();
