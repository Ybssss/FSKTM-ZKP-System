import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import UserProfileLink from "../../components/UserProfileLink";
import SortableTh from "../../components/SortableTh";
import useSortableData from "../../hooks/useSortableData";

// Reusable Tag Input Component for Expertise/Specialties
const TagInput = ({ tags, setTags, placeholder }) => {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const newTag = inputValue.replace(/\s+/g, " ").trim();

    if (
      newTag &&
      !tags.some((tag) => tag.toLowerCase() === newTag.toLowerCase())
    ) {
      setTags([...tags, newTag]);
    }

    setInputValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
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
            key={`${tag}-${index}`}
            className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:text-red-500 rounded-full p-0.5 ml-1 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={
            tags.length === 0 ? placeholder : "Type and press Enter..."
          }
          className="w-full text-sm outline-none bg-transparent"
        />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addTag}
          className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold border border-indigo-100 hover:bg-indigo-100"
        >
          Add
        </button>
      </div>
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
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [resettingUserId, setResettingUserId] = useState("");

  const [formData, setFormData] = useState({
    id: "",
    userId: "",
    name: "",
    email: "",
    role: "",
    originalRole: "",
    matricNumber: "",
    program: "",
    profession: "",
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
    ["panel", "admin"].includes(u.role),
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
      profession: targetUser.profession || "",
      researchTitle: targetUser.researchTitle || "",
      supervisorId:
        targetUser.supervisorId?._id || targetUser.supervisorId || "",
      expertiseTags: targetUser.expertiseTags || [],
    });
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (isCreatingUser) return;

    try {
      setIsCreatingUser(true);
      setNewCredentials(null);

      const payload = { ...formData };

      if (payload.role === "student") {
        if (!payload.matricNumber) {
          alert("Matric Number is required for students.");
          return;
        }

        const cleanMatric = payload.matricNumber
          .replace(/\s+/g, "")
          .toUpperCase();

        payload.userId = cleanMatric;
        payload.matricNumber = cleanMatric;
        payload.profession = "";
        payload.expertiseTags = [];
      } else if (payload.role === "panel" || payload.role === "admin") {
        if (!payload.userId.trim()) {
          alert("System User ID is required.");
          return;
        }

        // Preserve panel/admin User ID casing exactly as typed by admin.
        // Only remove spaces because this ID is used for login.
        payload.userId = payload.userId.replace(/\s+/g, "").trim();
        payload.profession = String(payload.profession || "").trim();
        payload.expertiseTags = Array.isArray(payload.expertiseTags)
          ? payload.expertiseTags
              .map((tag) => String(tag).trim())
              .filter(Boolean)
          : [];

        delete payload.researchTitle;
        delete payload.program;
        payload.supervisorId = null;
      }

      if (!payload.supervisorId) payload.supervisorId = null;

      const res = await api.post("/users", payload);

      if (res.data.success) {
        setNewCredentials({
          email: res.data.user?.email || payload.email,
          userId: res.data.user?.userId || payload.userId,
          name: res.data.user?.name || payload.name,
          registrationCode: res.data.registrationCode,
          message: res.data.message,
          emailStatus: res.data.emailStatus,
        });

        setShowCreateModal(false);
        await fetchUsers();

        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      if (payload.role !== payload.originalRole) {
        const confirmChange = window.confirm(
          `You are changing ${payload.name}'s role from [${payload.originalRole.toUpperCase()}] to [${payload.role.toUpperCase()}].\n\nDo you want to continue?`,
        );
        if (!confirmChange) return;
      }

      if (payload.role === "student" && payload.matricNumber) {
        payload.matricNumber = payload.matricNumber
          .replace(/\s+/g, "")
          .toUpperCase();
        payload.profession = "";
      } else if (payload.role === "panel" || payload.role === "admin") {
        payload.profession = String(payload.profession || "").trim();
        delete payload.researchTitle;
        delete payload.program;
      }

      if (!payload.supervisorId) payload.supervisorId = null;

      await api.put(`/users/${payload.id}`, payload);

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

      alert("User details updated successfully.");
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update user");
    }
  };

  const handleResetZkp = async (userId, name, email) => {
    if (resettingUserId) return;

    if (!window.confirm(`Reset ${name}'s keys?`)) return;

    try {
      setResettingUserId(userId);
      setNewCredentials(null);

      const res = await api.post(`/users/${userId}/reset-zkp`);

      if (res.data.success) {
        setNewCredentials({
          email,
          userId: res.data.userId,
          name: res.data.name,
          registrationCode: res.data.registrationCode,
          message: res.data.message,
          emailStatus: res.data.emailStatus,
        });

        await fetchUsers();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to reset user");
    } finally {
      setResettingUserId("");
    }
  };

  const getSupervisorNameForUser = useCallback((targetUser) => {
    if (!targetUser?.supervisorId) return "No Supervisor Assigned";
    if (typeof targetUser.supervisorId === "object" && targetUser.supervisorId.name) {
      return targetUser.supervisorId.name;
    }
    const foundSv = usersList.find((sysUser) => sysUser._id === targetUser.supervisorId);
    return foundSv?.name || "No Supervisor Assigned";
  }, [usersList]);

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const userSortAccessors = useMemo(
    () => ({
      user: (u) => `${u.name || ""} ${u.userId || ""}`,
      role: (u) => `${u.role || ""} ${u.program || ""} ${(u.expertiseTags || []).join(" ")}`,
      supervisor: (u) => (u.role === "student" ? getSupervisorNameForUser(u) : ""),
      status: (u) => (u.zkpRegistered ? "secured" : "pending setup"),
    }),
    [getSupervisorNameForUser],
  );

  const {
    sortedItems: sortedUsers,
    sortConfig: userSortConfig,
    requestSort: requestUserSort,
  } = useSortableData(filteredUsers, userSortAccessors, { key: "user" });

  const currentEmailStatus = newCredentials?.emailStatus || {};
  const emailFailed = Boolean(currentEmailStatus.error);
  const emailSent = Boolean(currentEmailStatus.sent);
  const emailQueued = Boolean(
    currentEmailStatus.queued &&
      !currentEmailStatus.sent &&
      !currentEmailStatus.error,
  );
  const emailStatusTone = emailFailed
    ? {
        panel: "bg-red-50 border-red-200",
        icon: "text-red-600",
        title: "text-red-900",
        text: "text-red-800",
        meta: "text-red-700",
        titleText: "Email Failed",
      }
    : emailSent
      ? {
          panel: "bg-blue-50 border-blue-200",
          icon: "text-blue-600",
          title: "text-blue-900",
          text: "text-blue-800",
          meta: "text-blue-700",
          titleText: "Registration Email",
        }
      : emailQueued
        ? {
            panel: "bg-blue-50 border-blue-200",
            icon: "text-blue-600",
            title: "text-blue-900",
            text: "text-blue-800",
            meta: "text-blue-700",
            titleText: "Email Queued",
          }
      : {
          panel: "bg-gray-50 border-gray-200",
          icon: "text-gray-600",
          title: "text-gray-900",
          text: "text-gray-700",
          meta: "text-gray-600",
          titleText: "Registration Email",
        };
  const emailStatusMessage =
    newCredentials?.message ||
    (emailSent
      ? "Email sent successfully."
      : emailFailed
        ? "Email failed to send."
        : "No receiver email was provided.");
  const emailReceiver =
    currentEmailStatus.receiver || newCredentials?.email || "None";

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
              originalRole: "",
              matricNumber: "",
              program: "",
              profession: "",
              researchTitle: "",
              supervisorId: "",
              expertiseTags: [],
            });
            setShowCreateModal(true);
          }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-sm flex items-center gap-2 transition-transform hover:scale-[1.02]"
        >
          <UserPlus className="w-5 h-5" /> Create New User
        </button>
      </div>

      {newCredentials && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 shadow-lg mb-6 relative z-10 animate-fade-in-down">
          <button
            onClick={() => setNewCredentials(null)}
            className="absolute top-4 right-4 text-green-700 hover:text-green-900 bg-green-100 p-1 rounded-full transition-colors"
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
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-3xl font-black text-indigo-600 tracking-widest bg-indigo-50 px-3 py-1 rounded border border-indigo-100 w-max">
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
                <div
                  className={`${emailStatusTone.panel} p-6 rounded-xl border flex flex-col justify-center items-center text-center h-full`}
                >
                  <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                    <Mail className={`w-8 h-8 ${emailStatusTone.icon}`} />
                  </div>
                  <h4
                    className={`text-base font-bold ${emailStatusTone.title} mb-2`}
                  >
                    {emailStatusTone.titleText}
                  </h4>
                  <p
                    className={`text-sm ${emailStatusTone.text} font-medium`}
                  >
                    {emailStatusMessage}
                  </p>
                  {emailFailed && (
                    <p className="text-xs text-red-700 mt-2 break-words">
                      {currentEmailStatus.error}
                    </p>
                  )}
                  <p className={`text-xs ${emailStatusTone.meta} mt-2`}>
                    Receiver: <strong>{emailReceiver}</strong>
                  </p>
                  {emailSent && currentEmailStatus.messageId && (
                    <p className="text-[10px] text-blue-700 mt-1 break-all">
                      Message ID: {currentEmailStatus.messageId}
                    </p>
                  )}
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
                <SortableTh className="p-4" sortKey="user" sortConfig={userSortConfig} onSort={requestUserSort}>User Info</SortableTh>
                <SortableTh className="p-4" sortKey="role" sortConfig={userSortConfig} onSort={requestUserSort}>Role & Details</SortableTh>
                <SortableTh className="p-4" sortKey="supervisor" sortConfig={userSortConfig} onSort={requestUserSort}>Supervisor</SortableTh>
                <SortableTh className="p-4" sortKey="status" sortConfig={userSortConfig} onSort={requestUserSort}>Status & Actions</SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-sm font-semibold text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : sortedUsers.map((u) => {
                let svName = "No Supervisor Assigned";
                let hasSv = false;
                let supervisorUser = null;
                if (u.supervisorId) {
                  hasSv = true;
                  if (typeof u.supervisorId === "object" && u.supervisorId.name) {
                    svName = u.supervisorId.name;
                    supervisorUser = u.supervisorId;
                  } else if (typeof u.supervisorId === "string") {
                    const foundSv = usersList.find(
                      (sysUser) => sysUser._id === u.supervisorId,
                    );
                    if (foundSv) {
                      svName = foundSv.name;
                      supervisorUser = foundSv;
                    }
                  }
                }
                return (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-bold text-gray-900">
                        <UserProfileLink user={u} className="font-bold" />
                      </p>
                      <p className="text-sm font-mono text-gray-500">
                        {u.userId}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          u.role === "admin"
                            ? "bg-red-100 text-red-800"
                            : "bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {u.role}
                      </span>

                      {(u.role === "panel" || u.role === "admin") &&
                        u.profession && (
                          <p className="mt-2 text-xs font-semibold text-gray-600">
                            {u.profession}
                          </p>
                        )}

                      {(u.role === "panel" || u.role === "admin") &&
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
                              <UserProfileLink
                                user={supervisorUser}
                                fallback={svName}
                                className="font-bold"
                              />
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

                        <div className="flex gap-3 mt-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="text-xs text-gray-600 hover:text-indigo-600 font-bold flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" /> Edit Info
                          </button>
                          <button
                            disabled={Boolean(resettingUserId)}
                            onClick={() =>
                              handleResetZkp(u.userId, u.name, u.email)
                            }
                            className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            {resettingUserId === u.userId
                              ? "Processing..."
                              : u.zkpRegistered
                                ? "Reset Keys"
                                : "Generate Code"}
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
              disabled={isCreatingUser}
              onClick={() => !isCreatingUser && setShowCreateModal(false)}
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
                      profession:
                        e.target.value === "student" ? "" : formData.profession,
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
                          matricNumber: e.target.value
                            .replace(/\s+/g, "")
                            .toUpperCase(),
                        })
                      }
                      className="w-full border-2 border-indigo-200 rounded p-2 uppercase font-bold focus:ring-2 focus:ring-indigo-500 bg-indigo-50"
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
                      className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full border rounded p-2 bg-white focus:ring-2 focus:ring-indigo-500"
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
              ) : formData.role === "panel" || formData.role === "admin" ? (
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
                      className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Position / Profession
                    </label>
                    <input
                      type="text"
                      value={formData.profession}
                      onChange={(e) =>
                        setFormData({ ...formData, profession: e.target.value })
                      }
                      placeholder="e.g. DS13 Pensyarah Kanan — Jabatan Multimedia"
                      className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Expertise / Specialty
                    </label>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                      Type a specialty and press ENTER to add it.
                    </p>
                    <TagInput
                      tags={formData.expertiseTags}
                      setTags={(newTags) =>
                        setFormData({ ...formData, expertiseTags: newTags })
                      }
                      placeholder="e.g. Artificial Intelligence"
                    />
                  </div>
                </>
              ) : null}

              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button
                  type="button"
                  disabled={isCreatingUser}
                  onClick={() => !isCreatingUser && setShowCreateModal(false)}
                  className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.role || isCreatingUser}
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isCreatingUser ? "Creating..." : "Create Account"}
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
                      You are demoting your own account. Saving will remove
                      admin access and redirect you to log in again.
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
                          matricNumber: e.target.value
                            .replace(/\s+/g, "")
                            .toUpperCase(),
                        })
                      }
                      className="w-full border rounded p-2 uppercase font-bold focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full border rounded p-2 bg-white focus:ring-2 focus:ring-indigo-500"
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

              {(formData.role === "panel" || formData.role === "admin") && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Position / Profession
                    </label>
                    <input
                      type="text"
                      value={formData.profession}
                      onChange={(e) =>
                        setFormData({ ...formData, profession: e.target.value })
                      }
                      placeholder="e.g. DS13 Pensyarah Kanan — Jabatan Multimedia"
                      className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Expertise / Specialty
                    </label>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                      Type a specialty and press ENTER to add it.
                    </p>
                    <TagInput
                      tags={formData.expertiseTags}
                      setTags={(newTags) =>
                        setFormData({ ...formData, expertiseTags: newTags })
                      }
                      placeholder="e.g. Artificial Intelligence"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700 transition-colors"
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
