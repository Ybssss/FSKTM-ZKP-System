import React, { useState } from "react";
import axios from "axios";

const AdminDashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Trigger the Full-Text Search API we built in Express
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);

    try {
      const res = await axios.get(
        `http://localhost:5000/api/evaluations/search?searchQuery=${searchQuery}`,
      );
      setSearchResults(res.data.results);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        Admin Dashboard: FSKTM Symposium
      </h1>

      {/* 1. Analytics Cards (Dr. Samihah's KPIs) */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Full-Text Search Feature (Historical Memory) */}
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
              placeholder='e.g., "methodology issues"'
              className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500"
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
                <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded">
                  {res.sessionId.semester}
                </span>
                <p className="mt-2 text-gray-800 font-semibold">
                  {res.panelId.name} wrote:
                </p>
                <p className="text-gray-600 mt-1 italic">
                  "{res.overallComments}"
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Timetable & Reminders */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h2 className="text-xl font-bold">Upcoming Timetable</h2>
            <button className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">
              + Schedule New Session
            </button>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3">Time</th>
                <th className="p-3">Student</th>
                <th className="p-3">Session Type</th>
                <th className="p-3">Panels</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {/* Mock Data - Fetch this from your backend */}
              <tr className="border-b">
                <td className="p-3">Today, 10:00 AM</td>
                <td className="p-3 font-semibold">Ali Bin Abu</td>
                <td className="p-3">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                    PROPOSAL_DEFENSE
                  </span>
                </td>
                <td className="p-3">Dr. Samihah, Prof. Ahmad</td>
                <td className="p-3">
                  <button className="text-red-600 hover:underline text-xs">
                    Send Reminder
                  </button>
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Tomorrow, 2:00 PM</td>
                <td className="p-3 font-semibold">Siti Nurhaliza</td>
                <td className="p-3">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                    UPGRADING
                  </span>
                </td>
                <td className="p-3">Dr. Kamal, Dr. Samihah</td>
                <td className="p-3">
                  <span className="text-gray-400 text-xs">
                    Notification Sent
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
