const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      //useNewUrlParser: true,
      //useUnifiedTopology: true,
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);

    await createIndexes();

  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    await db.collection("users").createIndex({ userId: 1 }, { unique: true });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ role: 1 });

    await db.collection("evaluations").createIndex({ studentId: 1, semester: 1 });
    await db.collection("evaluations").createIndex({ evaluatorId: 1 });
    await db.collection("evaluations").createIndex({ date: -1 });

    await db.collection("feedbackarchives").createIndex({
      fullText: "text",
      studentName: "text",
      evaluatorName: "text",
    });
    await db.collection("feedbackarchives").createIndex({ studentId: 1, date: -1 });

    await db.collection("timetables").createIndex({ studentId: 1, date: 1 });
    await db.collection("timetables").createIndex({ date: 1, status: 1 });

    await db.collection("attendances").createIndex({ studentId: 1, date: -1 });
    await db.collection("attendances").createIndex({ timetableId: 1 });

    console.log("Database indexes created");
  } catch (error) {
    console.error("Error creating indexes:", error.message);
  }
};

module.exports = connectDB;
