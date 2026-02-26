export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validateUserId = (userId) => {
  // Must be alphanumeric, 6-20 characters
  const re = /^[A-Z0-9]{6,20}$/;
  return re.test(userId);
};

export const validateMatricNumber = (matricNumber) => {
  // UTHM format: AI230131
  const re = /^[A-Z]{2}\d{6}$/;
  return re.test(matricNumber);
};

export const validateScore = (score) => {
  const num = parseFloat(score);
  return !isNaN(num) && num >= 0 && num <= 100;
};

export const validateRequired = (value) => {
  return value !== null && value !== undefined && value.toString().trim() !== '';
};

export const validateWeights = (criteria) => {
  const total = criteria.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
  return Math.abs(total - 100) < 0.01;
};