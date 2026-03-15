import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  // If it's live, use the Render URL. If local, use localhost.
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Request Interceptor: Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// NEW: Response Interceptor for Remote Wipe
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const msg = error.response.data?.message || "";
      // If the backend explicitly says the session/device was revoked
      if (
        msg.includes("revoked") ||
        msg.includes("removed") ||
        msg.includes("logged out")
      ) {
        console.warn("🚨 Device revoked remotely! Initiating self-destruct...");
        localStorage.clear(); // Wipes ALL ZKP keys, tokens, and preferences
        window.location.href = "/login?revoked=true";
      }
    }
    return Promise.reject(error);
  },
);

// ==========================================
// AUTH API - ZKP Authentication
// ==========================================
export const authAPI = {
  register: async (userId, publicKey, registrationCode) => {
    const response = await api.post("/auth/register", {
      userId,
      publicKey,
      registrationCode,
    });
    return response.data;
  },
  getChallenge: async (userId) => {
    const response = await api.post("/auth/challenge", { userId });
    return response.data;
  },
  verify: async (userId, proof, trustDevice) => {
    const response = await api.post("/auth/verify", {
      userId,
      proof,
      trustDevice,
    });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },
  getMyDevices: async () => {
    const response = await api.get("/auth/my-devices");
    return response.data;
  },
  removeDevice: async (deviceId) => {
    const response = await api.delete(`/auth/device/${deviceId}`);
    return response.data;
  },
  logoutAllDevices: async () => {
    const response = await api.post("/auth/logout-all-devices");
    return response.data;
  },
  adminResetZKP: async (userId) => {
    const response = await api.post(`/auth/admin/reset-zkp/${userId}`);
    return response.data;
  },
  adminLogoutUser: async (userId) => {
    const response = await api.post(`/auth/admin/logout-user/${userId}`);
    return response.data;
  },
  adminGetUserDevices: async (userId) => {
    const response = await api.get(`/auth/admin/user-devices/${userId}`);
    return response.data;
  },
  // UPDATED: Now accepts a unique client-side deviceId
  verify: async (userId, proof, trustDevice, deviceId) => {
    const response = await api.post("/auth/verify", {
      userId,
      proof,
      trustDevice,
      deviceId,
    });
    return response.data;
  },
  //Secure Device Pairing endpoints
  requestPairingCode: async (userId, tempPublicKeyBase64) => {
    // Updated to send temp key
    const response = await api.post("/auth/pairing/request", {
      userId,
      tempPublicKeyBase64,
    });
    return response.data;
  },
  getTempPublicKey: async (pairingCode) => {
    // NEW: No-Camera Fallback
    const response = await api.post("/auth/pairing/key", { pairingCode });
    return response.data;
  },
  submitEncryptedKey: async (pairingCode, encryptedPayload) => {
    const response = await api.post("/auth/pairing/submit", {
      pairingCode,
      encryptedPayload,
    });
    return response.data;
  },
  pollEncryptedKey: async (userId, pairingCode) => {
    const response = await api.post("/auth/pairing/poll", {
      userId,
      pairingCode,
    });
    return response.data;
  },
};

// ==========================================
// USER API
// ==========================================
export const userAPI = {
  getAll: async () => {
    const response = await api.get("/users");
    return response.data;
  },
  getMyStudents: async () => {
    const response = await api.get("/users/my-students");
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  create: async (userData) => {
    const response = await api.post("/users", userData);
    return response.data;
  },
  update: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
  assignPanel: async (studentId, panelIds, startDate, endDate) => {
    // Note: It points to the timetable assign-panel route we made earlier!
    const response = await api.post("/timetables/assign-panel", {
      studentId,
      panelIds,
      startDate,
      endDate,
    });
    return response.data;
  },
  unassignPanel: async (studentId, panelId) => {
    const response = await api.post("/users/unassign-panel", {
      studentId,
      panelId,
    });
    return response.data;
  },
};

// ==========================================
// EVALUATION API
// ==========================================
export const evaluationAPI = {
  getAll: async () => {
    const response = await api.get("/evaluations");
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/evaluations/${id}`);
    return response.data;
  },
  getByStudent: async (studentId) => {
    const response = await api.get(`/evaluations/student/${studentId}`);
    return response.data;
  },
  getStats: async (studentId) => {
    const response = await api.get(
      `/evaluations/stats${studentId ? `?studentId=${studentId}` : ""}`,
    );
    return response.data;
  },
  create: async (evaluationData) => {
    const response = await api.post("/evaluations", evaluationData);
    return response.data;
  },
  update: async (id, evaluationData) => {
    const response = await api.put(`/evaluations/${id}`, evaluationData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/evaluations/${id}`);
    return response.data;
  },
};

// ==========================================
// RUBRIC API
// ==========================================
export const rubricAPI = {
  getAll: async () => {
    const response = await api.get("/rubrics");
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/rubrics/${id}`);
    return response.data;
  },
  create: async (rubricData) => {
    const response = await api.post("/rubrics", rubricData);
    return response.data;
  },
  update: async (id, rubricData) => {
    const response = await api.put(`/rubrics/${id}`, rubricData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/rubrics/${id}`);
    return response.data;
  },
};

// ==========================================
// TIMETABLE API
// ==========================================
export const timetableAPI = {
  getAll: async () => {
    const response = await api.get("/timetables");
    return response.data;
  },
  getMy: async () => {
    const response = await api.get("/timetables/my");
    return response.data;
  },
  getMySessions: async () => {
    const response = await api.get("/timetables/my");
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/timetables/${id}`);
    return response.data;
  },
  create: async (timetableData) => {
    const response = await api.post("/timetables", timetableData);
    return response.data;
  },
  update: async (id, timetableData) => {
    const response = await api.put(`/timetables/${id}`, timetableData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/timetables/${id}`);
    return response.data;
  },
  uploadDocument: async (sessionId, documentData) => {
    const response = await api.post(
      `/timetables/${sessionId}/documents`,
      documentData,
    );
    return response.data;
  },
  deleteDocument: async (sessionId, documentId) => {
    const response = await api.delete(
      `/timetables/${sessionId}/documents/${documentId}`,
    );
    return response.data;
  },
  addNotes: async (sessionId, notesData) => {
    const response = await api.post(
      `/timetables/${sessionId}/notes`,
      notesData,
    );
    return response.data;
  },
};

// ==========================================
// FEEDBACK API
// ==========================================
export const feedbackAPI = {
  search: async (query, semester, studentId) => {
    let url = "/feedback/search?";
    if (query) url += `query=${encodeURIComponent(query)}&`;
    if (semester) url += `semester=${encodeURIComponent(semester)}&`;
    if (studentId) url += `studentId=${studentId}`;

    const response = await api.get(url);
    return response.data;
  },
  getSemesters: async () => {
    const response = await api.get("/feedback/semesters");
    return response.data;
  },
  getStats: async (studentId) => {
    const response = await api.get(
      `/feedback/stats${studentId ? `?studentId=${studentId}` : ""}`,
    );
    return response.data;
  },
  getRecent: async (limit = 10) => {
    const response = await api.get(`/feedback/recent?limit=${limit}`);
    return response.data;
  },
};

// ==========================================
// ATTENDANCE API
// ==========================================
export const attendanceAPI = {
  mark: async (attendanceData) => {
    const response = await api.post("/attendance", attendanceData);
    return response.data;
  },
  getMy: async () => {
    const response = await api.get("/attendance/my");
    return response.data;
  },
  getMyAttendance: async () => {
    const response = await api.get("/attendance/my");
    return response.data;
  },
  getByTimetable: async (timetableId) => {
    const response = await api.get(`/attendance/timetable/${timetableId}`);
    return response.data;
  },
  getStats: async (studentId) => {
    const response = await api.get(
      `/attendance/stats${studentId ? `?studentId=${studentId}` : ""}`,
    );
    return response.data;
  },
  update: async (id, attendanceData) => {
    const response = await api.put(`/attendance/${id}`, attendanceData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/attendance/${id}`);
    return response.data;
  },
};

// ==========================================
// QR CODE API
// ==========================================
export const qrAPI = {
  generate: async (timetableId) => {
    const response = await api.post(`/qr/generate/${timetableId}`);
    return response.data;
  },
  verify: async (timetableId, token, studentId) => {
    const response = await api.post("/qr/verify", {
      timetableId,
      token,
      studentId,
    });
    return response.data;
  },
  get: async (timetableId) => {
    const response = await api.get(`/qr/${timetableId}`);
    return response.data;
  },
};

// ==========================================
// ANALYTICS API - FIXED!
// ==========================================
export const analyticsAPI = {
  // Get stats for panel/admin dashboard
  getStats: async () => {
    const response = await api.get("/analytics/stats");
    return response.data;
  },

  // Get stats for student dashboard
  getStudentStats: async () => {
    const response = await api.get("/analytics/student-stats");
    return response.data;
  },

  // Alias for panel stats (for compatibility)
  getPanelStats: async () => {
    const response = await api.get("/analytics/stats");
    return response.data;
  },
};

export default api;
