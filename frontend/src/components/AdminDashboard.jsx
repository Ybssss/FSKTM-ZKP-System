import React, { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import { ShieldAlert, CheckCircle, XCircle, Clock } from "lucide-react";
import UserProfileLink from "./UserProfileLink";
import SortableTh from "./SortableTh";
import useSortableData from "../hooks/useSortableData";

const AdminDashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const upcomingTimetableRows = useMemo(
    () => [
      {
        id: "demo-upcoming-1",
        time: "Today, 10:00 AM",
        student: "Ali Bin Abu",
        sessionType: "PROPOSAL_DEFENSE",
        panels: "Dr. Samihah, Prof. Ahmad",
      },
    ],
    [],
  );
  const timetableSortAccessors = useMemo(
    () => ({
      time: (row) => row.time,
      student: (row) => row.student,
      sessionType: (row) => row.sessionType,
      panels: (row) => row.panels,
    }),
    [],
  );
  const {
    sortedItems: sortedTimetableRows,
    sortConfig: timetableSortConfig,
    requestSort: requestTimetableSort,
  } = useSortableData(upcomingTimetableRows, timetableSortAccessors, { key: "time" });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await api.get("/feedback/permissions/all");
      setPendingRequests(res.data.requests || []);
    } catch (error) {
      console.error("Failed to load requests", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleAction = async (requestId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`))
      return;
    try {
      await api.post("/feedback/permissions/respond", { requestId, action });
      loadRequests();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to process request.");
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);

    try {
      const res = await api.get(`/feedback/search?query=${searchQuery}`);
      setSearchResults(res.data.evaluations || []);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        System Coordinator Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-500 font-semibold">Active Sessions</p>
          <p className="text-3xl font-bold text-gray-800">42</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500 font-semibold">
            Pending Evaluations
          </p>
          <p className="text-3xl font-bold text-gray-800">12</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-500 font-semibold">
            Estimated Time Saved
          </p>
          <p className="text-3xl font-bold text-gray-800">14 hrs</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-sm text-gray-500 font-semibold">
            Upgrading Candidates
          </p>
          <p className="text-3xl font-bold text-gray-800">3</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">
            Historical Feedback Search
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Search across all previous semesters to maintain continuity.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder='e.g., "methodology issues" or student name'
              className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {isSearching ? "..." : "Search"}
            </button>
          </form>

          <div className="max-h-96 overflow-y-auto">
            {searchResults.length === 0 && !isSearching && (
              <p className="text-sm text-gray-400">No results found.</p>
            )}
            {searchResults.map((res, i) => (
              <div
                key={i}
                className="p-3 bg-gray-50 border rounded mb-2 text-sm"
              >
                <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded mb-1 inline-block">
                  {res.semester} |{" "}
                  <UserProfileLink
                    user={res.studentId}
                    fallback="Unknown Student"
                    className="font-bold"
                  />
                </span>
                <p className="text-gray-800 font-semibold mt-1">
                  <UserProfileLink
                    user={res.evaluatorId}
                    fallback="Unknown Evaluator"
                    className="font-semibold"
                  />{" "}
                  wrote:
                </p>
                <p className="text-gray-600 mt-1 italic">
                  "{res.overallComments || "View full report for details."}"
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h2 className="text-xl font-bold">Upcoming Timetable</h2>
            <button className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 font-bold">
              + Manage Schedule
            </button>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <SortableTh className="p-3 font-semibold" sortKey="time" sortConfig={timetableSortConfig} onSort={requestTimetableSort}>Time</SortableTh>
                <SortableTh className="p-3 font-semibold" sortKey="student" sortConfig={timetableSortConfig} onSort={requestTimetableSort}>Student</SortableTh>
                <SortableTh className="p-3 font-semibold" sortKey="sessionType" sortConfig={timetableSortConfig} onSort={requestTimetableSort}>Session Type</SortableTh>
                <SortableTh className="p-3 font-semibold" sortKey="panels" sortConfig={timetableSortConfig} onSort={requestTimetableSort}>Panels</SortableTh>
                <th className="p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedTimetableRows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-3">{row.time}</td>
                  <td className="p-3 font-bold text-gray-800">{row.student}</td>
                  <td className="p-3">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold uppercase">
                      {row.sessionType}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{row.panels}</td>
                  <td className="p-3">
                    <button className="text-red-600 font-bold text-xs hover:underline">
                      Send Reminder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-red-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-900">
                System Unlock & Access Approvals
              </h2>
              <p className="text-sm text-red-700">
                Approve or deny panel requests to view historical evaluations or
                edit locked documents.
              </p>
            </div>
          </div>
        </div>

        {loadingRequests ? (
          <div className="p-8 text-center text-gray-500 font-bold">
            Loading system requests...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-500 font-semibold bg-gray-50">
            No pending authorization requests.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingRequests.map((req) => (
              <div
                key={req._id}
                className="p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                      Request ID: {req._id.toString().slice(-6)}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                        req.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : req.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900">
                    <UserProfileLink
                      user={req.requestingPanelId}
                      fallback="Unknown Panel"
                      className="font-bold"
                    />{" "}
                    <span className="text-gray-400 font-normal text-sm">
                      is requesting access to
                    </span>{" "}
                    <UserProfileLink
                      user={req.studentId}
                      fallback="Unknown Student"
                      className="font-bold"
                    />
                  </h3>

                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Document:</strong>{" "}
                    {req.targetEvaluationId?.sessionType?.replace("_", " ")} (
                    {req.targetEvaluationId?.semester})
                  </p>

                  <div className="mt-3 bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">
                      Reason for override:
                    </span>
                    <p className="text-sm text-gray-800 italic">
                      "{req.reason}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0">
                  {req.status === "PENDING" ? (
                    <>
                      <button
                        onClick={() => handleAction(req._id, "REJECTED")}
                        className="flex-1 lg:flex-none px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg transition flex justify-center items-center gap-2"
                      >
                        <XCircle className="w-5 h-5" /> Deny
                      </button>
                      <button
                        onClick={() => handleAction(req._id, "APPROVED")}
                        className="flex-1 lg:flex-none px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-bold rounded-lg shadow transition flex justify-center items-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" /> Authorize Access
                      </button>
                    </>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-400 font-bold text-sm bg-gray-100 px-4 py-2 rounded-lg">
                      <Clock className="w-4 h-4" /> Processed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
