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

export default function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);

  // Email Config Memory
  const [senderEmail, setSenderEmail] = useState(
    localStorage.getItem("admin_sender_email") || "admin.fsktm@uthm.edu.my",
  );

  const [formData, setFormData] = useState({
    id: "",
    userId: "",
    name: "",
    email: "",
    role: "",
    matricNumber: "",
    program: "",
    researchTitle: "",
    supervisorId: "",
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

  const handleSenderChange = (e) => {
    const val = e.target.value;
    setSenderEmail(val);
    localStorage.setItem("admin_sender_email", val);
  };

  const supervisors = usersList.filter(
    (u) => u.role === "supervisor" || u.role === "panel",
  );

  const openEditModal = (targetUser) => {
    setFormData({
      id: targetUser._id,
      userId: targetUser.userId,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      matricNumber: targetUser.matricNumber || "",
      program: targetUser.program || "",
      researchTitle: targetUser.researchTitle || "",
    });
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/users", formData);
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
      await api.put(`/users/${formData.id}`, formData);
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

  const getRoleBadge = (role) => {
    const styles = {
      superadmin: "bg-purple-100 text-purple-800",
      admin: "bg-red-100 text-red-800",
      coordinator: "bg-orange-100 text-orange-800",
      panel: "bg-blue-100 text-blue-800",
      supervisor: "bg-cyan-100 text-cyan-800",
      student: "bg-green-100 text-green-800",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles[role] || "bg-gray-100"}`}
      >
        {role}
      </span>
    );
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
            });
            setShowCreateModal(true);
          }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-sm flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" /> Create New User
        </button>
      </div>

      {/* SUCCESS POPUP FOR NEW CREDENTIALS */}
      {newCredentials && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 shadow-lg mb-6 relative">
          <button
            onClick={() => setNewCredentials(null)}
            className="absolute top-4 right-4 text-green-700"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-900">
                Credentials Generated!
              </h3>
              <p className="text-green-800 mb-4">
                Send these to <strong>{newCredentials.name}</strong> securely so
                they can log in.
              </p>

              <div className="bg-white p-5 rounded-lg border border-green-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">
                    User ID
                  </p>
                  <p className="font-mono text-lg font-bold text-gray-900 mb-3">
                    {newCredentials.userId}
                  </p>

                  <p className="text-sm font-bold text-gray-500 uppercase">
                    Registration Code
                  </p>
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-2xl font-black text-indigo-600 tracking-widest">
                      {newCredentials.registrationCode}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `User ID: ${newCredentials.userId}\nRegistration Code: ${newCredentials.registrationCode}`,
                        );
                        alert("Copied to clipboard!");
                      }}
                      className="p-2 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email Configuration
                  </h4>

                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Send From (Saved to Memory)
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={handleSenderChange}
                    className="w-full text-sm p-2 border rounded mb-3 bg-white"
                    placeholder="your.admin@email.com"
                  />

                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Send To (Auto-filled)
                  </label>
                  <input
                    type="email"
                    value={newCredentials.email}
                    readOnly
                    className="w-full text-sm p-2 border rounded mb-4 bg-gray-100 text-gray-600 cursor-not-allowed"
                  />

                  <a
                    href={`mailto:${newCredentials.email}?subject=Your FSKTM ZKP System Credentials&body=Hello ${newCredentials.name},%0D%0A%0D%0APlease use the following credentials to set up your passwordless login on the FSKTM ZKP System:%0D%0A%0D%0AUser ID: ${newCredentials.userId}%0D%0ARegistration Code: ${newCredentials.registrationCode}%0D%0A%0D%0ARegards,%0D%0AFSKTM Admin`}
                    className="w-full inline-flex justify-center items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Open Mail Client
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 bg-gray-50 border-b flex items-center">
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
                <th className="p-4 font-semibold">User Info</th>
                <th className="p-4 font-semibold">Role & Details</th>
                <th className="p-4 font-semibold">Supervisor</th>
                <th className="p-4 font-semibold">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                let svName = "No Supervisor Assigned";
                let hasSv = false;

                if (u.supervisorId) {
                  hasSv = true;
                  if (
                    typeof u.supervisorId === "object" &&
                    u.supervisorId.name
                  ) {
                    svName = u.supervisorId.name;
                  } else if (typeof u.supervisorId === "string") {
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
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-indigo-100 text-indigo-800">
                        {u.role}
                      </span>
                      {u.role === "panel" && u.expertiseTags && (
                        <p
                          className="text-xs text-gray-500 mt-2 line-clamp-2 w-48"
                          title={u.expertiseTags.join(", ")}
                        >
                          Expertise: {u.expertiseTags.join(", ")}
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
                            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
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

      {/* CREATE / EDIT MODALS */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4 border-b pb-2">
              Edit User Profile
            </h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  System User ID (Read-Only)
                </label>
                <input
                  type="text"
                  value={formData.userId}
                  disabled
                  className="w-full border rounded p-2 bg-gray-100 text-gray-500 cursor-not-allowed font-mono"
                />
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
                          matricNumber: e.target.value,
                        })
                      }
                      className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}
              <div className="pt-4 flex justify-end gap-3 border-t">
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
