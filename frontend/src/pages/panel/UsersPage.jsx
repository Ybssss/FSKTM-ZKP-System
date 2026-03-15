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
} from "lucide-react";
import api from "../../services/api";

export default function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // State for the newly generated code popup
  const [newCredentials, setNewCredentials] = useState(null);

  const [formData, setFormData] = useState({
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

  // Filter out available supervisors for the dropdown
  const supervisors = usersList.filter(
    (u) => u.role === "supervisor" || u.role === "panel",
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/users", formData);
      if (res.data.success) {
        setNewCredentials({
          userId: res.data.user.userId,
          name: res.data.user.name,
          registrationCode: res.data.registrationCode,
        });
        // ✅ AUTO-COPY TO CLIPBOARD
        navigator.clipboard.writeText(
          `Welcome ${res.data.user.name}!\nYour System ID: ${res.data.user.userId}\nYour First-Time Setup Code: ${res.data.registrationCode}`,
        );

        setShowModal(false);
        setFormData({
          userId: "",
          name: "",
          email: "",
          role: "",
          matricNumber: "",
          program: "",
          researchTitle: "",
          supervisorId: "",
        });
        fetchUsers();
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create user");
    }
  };

  const handleResetZkp = async (userId, name) => {
    if (!window.confirm(`⚠️ WARNING: Erase ${name}'s keys?`)) return;
    try {
      const res = await api.post(`/users/${userId}/reset-zkp`);
      if (res.data.success) {
        setNewCredentials({
          userId: res.data.userId,
          name: res.data.name,
          registrationCode: res.data.registrationCode,
        });
        // ✅ AUTO-COPY TO CLIPBOARD
        navigator.clipboard.writeText(
          `Hello ${res.data.name},\nYour ZKP Keys have been reset.\nNew Setup Code: ${res.data.registrationCode}`,
        );
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
            <Users className="w-8 h-8 text-indigo-600" />
            User & Role Management
          </h1>
          <p className="text-gray-600 mt-2">
            {isSuperAdmin
              ? "Full system control. Manage Admins and higher."
              : "Manage Students, Panels, and Supervisors."}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-semibold shadow-sm"
        >
          <UserPlus className="w-5 h-5" />
          Create New User
        </button>
      </div>

      {/* SUCCESS POPUP FOR NEW CREDENTIALS */}
      {newCredentials && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 shadow-lg mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <button
              onClick={() => setNewCredentials(null)}
              className="text-green-700 hover:text-green-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex items-start gap-4">
            <CheckCircle className="w-10 h-10 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-green-900 mb-1">
                User Created Successfully!
              </h3>
              <p className="text-green-800 mb-4">
                Please copy these credentials and send them to{" "}
                <strong>{newCredentials.name}</strong> securely. They will need
                this code for their first login.
              </p>

              <div className="bg-white p-4 rounded-lg border border-green-200 inline-block">
                <p className="text-sm text-gray-600 mb-1">User ID:</p>
                <p className="font-mono text-lg font-bold text-gray-900 mb-3">
                  {newCredentials.userId}
                </p>

                <p className="text-sm text-gray-600 mb-1">
                  First-Time Registration Code:
                </p>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-2xl font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded border border-indigo-100 tracking-widest">
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
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50 rounded-t-xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by Name or User ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="p-4 font-semibold">User Info</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Supervisor / Dept</th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-bold text-gray-900">{u.name}</p>
                    <p className="text-sm text-gray-500 font-mono">
                      {u.userId}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="p-4">{getRoleBadge(u.role)}</td>
                  <td className="p-4 text-sm text-gray-600">
                    {u.role === "student" ? (
                      u.supervisorId ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">
                            {u.supervisorId.name}
                          </span>
                          <span className="text-xs text-indigo-600 font-medium">
                            Supervisor
                          </span>
                        </div>
                      ) : (
                        <span className="text-red-500 font-medium">
                          No Supervisor Assigned
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="p-4">
                    {u.zkpRegistered ? (
                      <div className="flex flex-col items-start gap-2">
                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200">
                          <Shield className="w-3 h-3" /> SECURED
                        </span>
                        {/* THE NEW RESET BUTTON */}
                        <button
                          onClick={() => handleResetZkp(u.userId, u.name)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold underline transition-colors"
                          title="Erase their keys and generate a new code"
                        >
                          Reset Keys
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-200">
                        PENDING SETUP
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                Create New System User
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    User Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- Select Role --</option>
                    {/* Role Enforcement logic */}
                    {isSuperAdmin && <option value="admin">Admin (PIC)</option>}
                    {/* Both Superadmin AND Admin can create these: */}
                    {(isAdmin || isSuperAdmin) && (
                      <>
                        <option value="student">Postgraduate Student</option>
                        <option value="panel">Evaluating Panel</option>
                        <option value="supervisor">Supervisor</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    System User ID *
                  </label>
                  <input
                    type="text"
                    value={formData.userId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        userId: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-indigo-500 uppercase"
                    placeholder="e.g. STU001"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
              </div>

              {/* Dynamic Student Fields */}
              {formData.role === "student" && (
                <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 space-y-4 mt-4">
                  <h4 className="font-bold text-indigo-900 border-b border-indigo-200 pb-2">
                    Academic Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Matric Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.matricNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            matricNumber: e.target.value,
                          })
                        }
                        className="w-full border border-gray-300 rounded p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Program *
                      </label>
                      <select
                        required
                        value={formData.program}
                        onChange={(e) =>
                          setFormData({ ...formData, program: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded p-2"
                      >
                        <option value="">Select Program...</option>
                        <option value="Master of Computer Science">
                          Master of Computer Science
                        </option>
                        <option value="PhD in Information Technology">
                          PhD in Information Technology
                        </option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Research Title
                    </label>
                    <input
                      type="text"
                      value={formData.researchTitle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          researchTitle: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 text-indigo-800 flex items-center gap-1">
                      <UserPlus className="w-4 h-4" /> Assign Supervisor *
                    </label>
                    <select
                      required
                      value={formData.supervisorId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          supervisorId: e.target.value,
                        })
                      }
                      className="w-full border border-indigo-300 rounded p-2 bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose a Supervisor --</option>
                      {supervisors.map((sup) => (
                        <option key={sup._id} value={sup._id}>
                          {sup.name} ({sup.userId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700"
                >
                  Create User & Generate Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
