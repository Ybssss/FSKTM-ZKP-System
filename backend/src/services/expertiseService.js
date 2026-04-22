// src/services/expertiseService.js
const axios = require("axios");
const cheerio = require("cheerio");

class ExpertiseService {
  constructor() {
    this.baseUrl = "https://community.uthm.edu.my";
    this.cache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Fetch expertise data for a specific user from UTHM Community
   * @param {string} userId - The user ID to fetch expertise for
   * @returns {Promise<Array>} Array of expertise tags
   */
  async fetchUserExpertise(userId) {
    try {
      // Check cache first
      const cached = this.getCachedExpertise(userId);
      if (cached) {
        return cached;
      }

      // Fetch from UTHM Community site
      const expertise = await this.scrapeUserExpertise(userId);

      // Cache the result
      this.setCachedExpertise(userId, expertise);

      return expertise;
    } catch (error) {
      console.error(
        `Error fetching expertise for user ${userId}:`,
        error.message,
      );
      // Return empty array on error to prevent system failure
      return [];
    }
  }

  /**
   * Scrape expertise data from UTHM Community profile
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of expertise tags
   */
  async scrapeUserExpertise(userId) {
    try {
      // Construct the profile URL - this may need adjustment based on actual URL structure
      const profileUrl = `${this.baseUrl}/profile/${userId}`;

      console.log(`🔍 Fetching expertise from: ${profileUrl}`);

      const response = await axios.get(profileUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          "User-Agent": "UTHM-ZKP-System/1.0 (Academic Research System)",
        },
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse the HTML to extract expertise
      const expertise = this.parseExpertiseFromHTML(response.data);

      console.log(
        `✅ Found ${expertise.length} expertise areas for ${userId}:`,
        expertise,
      );
      return expertise;
    } catch (error) {
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        console.warn(`⚠️ UTHM Community site unreachable: ${error.message}`);
      } else {
        console.error(
          `❌ Error scraping expertise for ${userId}:`,
          error.message,
        );
      }
      return [];
    }
  }

  /**
   * Parse expertise from HTML content
   * @param {string} html - The HTML content
   * @returns {Array} Array of expertise strings
   */
  parseExpertiseFromHTML(html) {
    try {
      const $ = cheerio.load(html);
      const expertise = [];

      // Look for common patterns in academic profile pages
      // These selectors may need adjustment based on actual site structure

      // Try multiple possible selectors for expertise/research areas
      const selectors = [
        ".expertise",
        ".research-areas",
        ".specialization",
        ".field-of-study",
        ".research-interests",
        ".expertise-tags",
        ".research-tags",
        '[data-field="expertise"]',
        '[data-field="research"]',
        ".profile-expertise",
        ".academic-interests",
      ];

      for (const selector of selectors) {
        $(selector).each((i, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length > 0) {
            // Split by common delimiters and clean up
            const tags = text
              .split(/[,;|\n]/)
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0 && tag.length < 100); // Reasonable length filter

            expertise.push(...tags);
          }
        });

        // If we found expertise, break
        if (expertise.length > 0) break;
      }

      // Remove duplicates and clean
      const uniqueExpertise = [...new Set(expertise)]
        .map((exp) => exp.toLowerCase().trim())
        .filter((exp) => exp.length > 1); // Remove single characters

      return uniqueExpertise;
    } catch (error) {
      console.error("Error parsing HTML for expertise:", error.message);
      return [];
    }
  }

  /**
   * Get cached expertise data
   * @param {string} userId
   * @returns {Array|null} Cached expertise or null if not found/expired
   */
  getCachedExpertise(userId) {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached expertise data
   * @param {string} userId
   * @param {Array} expertise
   */
  setCachedExpertise(userId, expertise) {
    this.cache.set(userId, {
      data: expertise,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for a specific user
   * @param {string} userId
   */
  clearUserCache(userId) {
    this.cache.delete(userId);
  }

  /**
   * Clear all cached data
   */
  clearAllCache() {
    this.cache.clear();
  }

  /**
   * Match student research title with panel expertise
   * @param {string} researchTitle - Student's research title
   * @param {Array} panelExpertise - Array of panel's expertise tags
   * @returns {Object} Match result with score and matched terms
   */
  matchExpertise(researchTitle, panelExpertise) {
    if (!researchTitle || !panelExpertise || panelExpertise.length === 0) {
      return { score: 0, matches: [], isMatch: false };
    }

    const title = researchTitle.toLowerCase();
    const matches = [];
    let totalScore = 0;

    for (const expertise of panelExpertise) {
      const exp = expertise.toLowerCase();

      // Exact match gets highest score
      if (title.includes(exp) || exp.includes(title)) {
        matches.push({ term: expertise, type: "exact", score: 100 });
        totalScore += 100;
      }
      // Partial word matches
      else {
        const words = exp.split(/\s+/);
        let wordMatches = 0;

        for (const word of words) {
          if (word.length > 2 && title.includes(word)) {
            wordMatches++;
          }
        }

        if (wordMatches > 0) {
          const score = Math.min(80, wordMatches * 20);
          matches.push({ term: expertise, type: "partial", score });
          totalScore += score;
        }
      }
    }

    // Average score across all expertise areas
    const avgScore = matches.length > 0 ? totalScore / matches.length : 0;

    return {
      score: Math.round(avgScore),
      matches,
      isMatch: avgScore >= 30, // Consider it a match if score >= 30
    };
  }

  /**
   * Get recommended panels for a student based on research title
   * @param {string} researchTitle - Student's research title
   * @param {Array} availablePanels - Array of panel objects with userId and cached expertise
   * @returns {Array} Sorted array of panel recommendations
   */
  getPanelRecommendations(researchTitle, availablePanels) {
    const recommendations = [];

    for (const panel of availablePanels) {
      const match = this.matchExpertise(researchTitle, panel.expertise || []);
      if (match.isMatch) {
        recommendations.push({
          panelId: panel._id || panel.id,
          userId: panel.userId,
          name: panel.name,
          match,
        });
      }
    }

    // Sort by match score (highest first)
    return recommendations.sort((a, b) => b.match.score - a.match.score);
  }
}

module.exports = new ExpertiseService();
