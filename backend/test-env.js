require('dotenv').config();

console.log('Testing .env file loading:');
console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('PORT:', process.env.PORT);

if (!process.env.MONGO_URI) {
  console.log('❌ MONGO_URI is undefined!');
  console.log('Current directory:', __dirname);
  console.log('.env path should be:', __dirname + '/.env');
} else {
  console.log('✅ .env loaded successfully!');
}