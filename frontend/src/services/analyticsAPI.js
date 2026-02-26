import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const analyticsAPI = {
  // Get overview statistics
  async getOverview() {
    try {
      const response = await axios.get(`${API_URL}/analytics/overview`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      throw error;
    }
  },

  // Get panel statistics
  async getPanelStats(panelId) {
    try {
      const response = await axios.get(`${API_URL}/analytics/panel/${panelId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching panel stats:', error);
      throw error;
    }
  },

  // Get evaluation trends
  async getEvaluationTrends(period = '30d') {
    try {
      const response = await axios.get(`${API_URL}/analytics/trends`, {
        params: { period },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching evaluation trends:', error);
      throw error;
    }
  },

  // Get recent activity
  async getRecentActivity(limit = 10) {
    try {
      const response = await axios.get(`${API_URL}/analytics/activity`, {
        params: { limit },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      throw error;
    }
  },
};

export default analyticsAPI;
