import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Users,
  UserPlus,
  Shield,
  X,
  Copy,
  CheckCircle,
  Search,
  Mail,
  Edit,
} from "lucide-react";
import api from "../../services/api";

// Reusable Tag Input Component for Expertise/Specialties
const TagInput = ({ tags, setTags, placeholder }) => {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setInputValue("");
    }
  };

  const removeTag = (indexToRemove) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="w-full border border-gray-300 rounded-lg p-2 focus-within:ring-2 focus-within:ring-indigo-500 bg-white min-h-[50px]">
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:text-red-500 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          tags.length === 0 ? placeholder : "Type and press Enter..."
        }
        className="w-full text-sm outline-none bg-transparent"
      />
    </div>
  );
};

export default function UsersPage() {
  const { user } = useAuth();

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);

  const [formData, setFormData] = useState({
    id: "",
    userId: "",
    name: "",
    email: "",
    role: "",
    originalRole: "",
    matricNumber: "",
    program: "",
    researchTitle: "",
    supervisorId: "",
    expertiseTags: [],
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setUsersList(res.data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const potentialSupervisors = usersList.filter((u) =>
    ["panel", "admin", "superadmin"].includes(u.role),
  );

  const openEditModal = (targetUser) => {
    setFormData({
      id: targetUser._id,
      userId: targetUser.userId,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      originalRole: targetUser.role,
      matricNumber: targetUser.matricNumber || "",
      program: targetUser.program || "",
      researchTitle: targetUser.researchTitle || "",
      supervisorId:
        targetUser.supervisorId?._id || targetUser.supervisorId || "",
      // 🔴 Turn array back into comma-separated string for editing
      expertiseTags: targetUser.expertiseTags || [],
    });
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      if (payload.role === "student") {
        if (!payload.matricNumber)
          return alert("Matric Number is required for students.");
        payload.userId = payload.matricNumber.toUpperCase();
        payload.matricNumber = payload.matricNumber.toUpperCase();
      } else if (payload.role === "panel") {
        delete payload.researchTitle;
        delete payload.program;
      }

      if (!payload.supervisorId) payload.supervisorId = null;

      const res = await api.post("/users", payload);
      if (res.data.success) {
        setNewCredentials({
          email: res.data.user.email,
          userId: res.data.user.userId,
          name: res.data.user.name,
          registrationCode: res.data.registrationCode,
        });
        setShowCreateModal(false);
        fetchUsers();
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create user");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      // 🔴 IDIOT-PROOF: Strict Role Change Warning
      if (payload.role !== payload.originalRole) {
        const confirmChange = window.confirm(
          `🚨 CRITICAL ACTION: You are changing ${payload.name}'s role from [${payload.originalRole.toUpperCase()}] to [${payload.role.toUpperCase()}].\n\nAre you absolutely sure you want to do this?`,
        );
        if (!confirmChange) return;
      }

      if (payload.role === "student" && payload.matricNumber) {
        // 🔴 IDIOT-PROOF: Strip accidental spaces and force uppercase
        payload.matricNumber = payload.matricNumber
          .replace(/\s+/g, "")
          .toUpperCase();
      } else if (payload.role === "panel") {
        delete payload.researchTitle;
        delete payload.program;

        payload.expertiseTags = payload.expertiseInput
          ? payload.expertiseInput
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [];
      }

      if (!payload.supervisorId) payload.supervisorId = null;

      await api.put(`/users/${payload.id}`, payload);
      // HANDOVER: If they just demoted themselves, log them out instantly!
      if (
        payload.id === (user.id || user._id) &&
        payload.role !== payload.originalRole
      ) {
        alert(
          "You have successfully stepped down from Administrator. Please log in again to access your new Panel dashboard.",
        );
        window.location.href = "/login";
        return;
      }

      alert("✅ User details updated successfully!");
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update user");
    }
  };

  const handleResetZkp = async (userId, name, email) => {
    if (!window.confirm(`⚠️ WARNING: Erase ${name}'s keys?`)) return;
    try {
      const res = await api.post(`/users/${userId}/reset-zkp`);
      if (res.data.success) {
        setNewCredentials({
          email: email,
          userId: res.data.userId,
          name: res.data.name,
          registrationCode: res.data.registrationCode,
        });
        fetchUsers();
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to reset user");
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" /> User & Role Management
          </h1>
        </div>
        <button
          onClick={() => {
            setFormData({
              id: "",
              userId: "",
              name: "",
              email: "",
              role: "",
              matricNumber: "",
              program: "",
              researchTitle: "",
              supervisorId: "",
              expertiseInput: "",
            });
            setShowCreateModal(true);
          }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-sm flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" /> Create New User
        </button>
      </div>

      {newCredentials && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 shadow-lg mb-6 relative z-10 animate-fade-in-down">
          <button
            onClick={() => setNewCredentials(null)}
            className="absolute top-4 right-4 text-green-700 hover:text-green-900 bg-green-100 p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-12 h-12 text-green-600 shrink-0" />
            <div className="flex-1 w-full">
              <h3 className="text-xl font-bold text-green-900 mb-1">
                Keys Generated Successfully!
              </h3>
              <div className="bg-white p-6 rounded-xl border border-green-200 grid grid-cols-1 lg:grid-cols-2 gap-6 shadow-sm mt-4">
                <div className="flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    System Login ID
                  </p>
                  <p className="font-mono text-xl font-bold text-gray-900 mb-5">
                    {newCredentials.userId}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Secure Registration Code
                  </p>
                  <p className="font-mono text-3xl font-black text-indigo-600 tracking-widest bg-indigo-50 px-3 py-1 rounded border border-indigo-100 w-max">
                    {newCredentials.registrationCode}
                  </p>
                </div>
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 flex flex-col justify-center items-center text-center h-full">
                  <Mail className="w-8 h-8 text-blue-600 mb-2" />
                  <h4 className="text-base font-bold text-blue-900 mb-2">
                    Automated Email Dispatched
                  </h4>
                  <p className="text-sm text-blue-800">
                    Instructions emailed to{" "}
                    <strong>{newCredentials.email}</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 bg-gray-50 border-b flex items-center relative">
          <Search className="w-5 h-5 text-gray-400 absolute ml-3" />
          <input
            type="text"
            placeholder="Search by Name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-sm text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="p-4">User Info</th>
                <th className="p-4">Role & Details</th>
                <th className="p-4">Supervisor</th>
                <th className="p-4">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                let svName = "No Supervisor Assigned";
                let hasSv = false;
                if (u.supervisorId) {
                  hasSv = true;
                  if (typeof u.supervisorId === "object" && u.supervisorId.name)
                    svName = u.supervisorId.name;
                  else if (typeof u.supervisorId === "string") {
                    const foundSv = usersList.find(
                      (sysUser) => sysUser._id === u.supervisorId,
                    );
                    if (foundSv) svName = foundSv.name;
                  }
                }
                return (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-bold text-gray-900">{u.name}</p>
                      <p className="text-sm font-mono text-gray-500">
                        {u.userId}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${u.role === "admin" || u.role === "superadmin" ? "bg-red-100 text-red-800" : "bg-indigo-100 text-indigo-800"}`}
                      >
                        {u.role}
                      </span>

                      {/* 🔴 NEW: Displays tags as beautiful Pills! */}
                      {u.role === "panel" &&
                        u.expertiseTags &&
                        u.expertiseTags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1 w-56">
                            {u.expertiseTags.map((tag, i) => (
                              <span
                                key={i}
                                className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                      {u.role === "student" && u.researchTitle && (
                        <p className="text-xs text-indigo-600 italic mt-2 line-clamp-2 w-48">
                          "{u.researchTitle}"
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {u.role === "student" ? (
                        hasSv ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">
                              {svName}
                            </span>
                            <span className="text-[10px] text-indigo-600 font-bold uppercase">
                              Supervisor
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded text-xs border border-red-100">
                            NO SUPERVISOR
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col items-start gap-2">
                        {u.zkpRegistered ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200">
                            <Shield className="w-3 h-3" /> SECURED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-200">
                            PENDING SETUP
                          </span>
                        )}

                        {/* 🔴 IDIOT-PROOF: Hierarchy Protection */}
                        <div className="flex gap-3 mt-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="text-xs text-gray-600 hover:text-indigo-600 font-bold flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" /> Edit Info
                          </button>
                          <button
                            onClick={() =>
                              handleResetZkp(u.userId, u.name, u.email)
                            }
                            className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1"
                          >
                            {u.zkpRegistered ? "Reset Keys" : "Generate Code"}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-indigo-600" /> Create New User
            </h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value,
                      userId:
                        e.target.value === "student" ? "" : formData.userId,
                    })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Select a role...</option>
                  <option value="admin">Administrator</option>
                  <option value="panel">Panel / Examiner</option>
                  <option value="student">Student</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {formData.role === "student" ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-indigo-700 mb-1">
                      Matric Number (Becomes User ID) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.matricNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          matricNumber: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full border-2 border-indigo-200 rounded p-2 uppercase font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Research Project Title
                    </label>
                    <textarea
                      value={formData.researchTitle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          researchTitle: e.target.value,
                        })
                      }
                      className="w-full border rounded p-2"
                      rows="2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Assign Supervisor
                    </label>
                    <select
                      value={formData.supervisorId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          supervisorId: e.target.value,
                        })
                      }
                      className="w-full border rounded p-2 bg-white"
                    >
                      <option value="">-- No Supervisor --</option>
                      {potentialSupervisors.map((sv) => (
                        <option key={sv._id} value={sv._id}>
                          {sv.name} ({sv.userId})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : formData.role === "panel" ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      System User ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.userId}
                      onChange={(e) =>
                        setFormData({ ...formData, userId: e.target.value })
                      }
                      className="w-full border rounded p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Expertise / Specialty
                    </label>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                      Separate skills with commas (e.g. AI, Cyber Security, HCI)
                    </p>
                    <textarea
                      rows="2"
                      value={formData.expertiseInput}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          expertiseInput: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded p-3 font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Artificial Intelligence, Data Mining"
                    />
                  </div>
                </>
              ) : (
                formData.role !== "" && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      System User ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.userId}
                      onChange={(e) =>
                        setFormData({ ...formData, userId: e.target.value })
                      }
                      className="w-full border rounded p-2"
                    />
                  </div>
                )
              )}
              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.role}
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
              <Edit className="w-6 h-6 text-indigo-600" /> Edit User Profile
            </h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 mb-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">
                    System Login ID (Read Only)
                  </p>
                  <p className="text-sm font-mono text-gray-700">
                    {usersList.find((u) => u._id === formData.id)?.userId}
                  </p>
                </div>
              </div>

              {/* HANDOVER PROTOCOL */}
              <div className="bg-red-50 p-4 border border-red-200 rounded-lg">
                <label className="block text-sm font-bold text-red-700 mb-1">
                  System Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full border-2 border-red-300 bg-white text-red-900 font-bold rounded p-2 focus:ring-2 focus:ring-red-500"
                >
                  <option value="student">Student</option>
                  <option value="panel">Panel / Examiner</option>
                  <option value="admin">Administrator</option>
                </select>
                {formData.id === (user.id || user._id) &&
                  formData.role !== "admin" && (
                    <p className="text-[10px] text-red-600 font-bold mt-2 uppercase bg-red-100 p-2 rounded">
                      🚨 WARNING: You are demoting YOURSELF. If you save, you
                      will instantly lose Admin access and be redirected!
                    </p>
                  )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {formData.role === "student" && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Matric Number
                    </label>
                    <input
                      type="text"
                      value={formData.matricNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          matricNumber: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full border rounded p-2 uppercase font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Research Title
                    </label>
                    <textarea
                      rows="2"
                      value={formData.researchTitle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          researchTitle: e.target.value,
                        })
                      }
                      className="w-full border rounded p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Assign Supervisor
                    </label>
                    <select
                      value={formData.supervisorId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          supervisorId: e.target.value,
                        })
                      }
                      className="w-full border rounded p-2 bg-white"
                    >
                      <option value="">-- No Supervisor --</option>
                      {potentialSupervisors.map((sv) => (
                        <option key={sv._id} value={sv._id}>
                          {sv.name} ({sv.userId})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formData.role === "panel" && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Expertise / Specialty
                  </label>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                    Type a specialty and press ENTER to add it.
                  </p>

                  {/* DYNAMIC TAG INPUT */}
                  <TagInput
                    tags={formData.expertiseTags}
                    setTags={(newTags) =>
                      setFormData({ ...formData, expertiseTags: newTags })
                    }
                    placeholder="e.g. Artificial Intelligence"
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
