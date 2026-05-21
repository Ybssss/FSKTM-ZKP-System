const axios = require("axios");
const cheerio = require("cheerio");

class ExpertiseService {
  constructor() {
    this.baseUrl = "https://community.uthm.edu.my";
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000;

    this.profileSlugMap = {
      admin_samihah: "samihah",
      samihah: "samihah",
      panel_zkp: "nurziadah",
      nurziadah: "nurziadah",
      panel_ai: "shahreen",
      shahreen: "shahreen",
      panel_blockchain: "sapiee",
      sapiee: "sapiee",
      panel_web: "nrliyana",
      nurliyana: "nrliyana",
      nrliyana: "nrliyana",
      panel_network: "zubaile",
      zubaile: "zubaile",
    };
  }

  normalizeKey(value = "") {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/community\.uthm\.edu\.my\//, "")
      .replace(/^staff\/people\//, "")
      .replace(/^profile\//, "")
      .replace(/\?.*$/, "")
      .replace(/\/$/, "");
  }

  resolveProfileIdentifier(identifier = "") {
    const key = this.normalizeKey(identifier);
    const mapped = this.profileSlugMap[key] || key;

    if (!mapped) return null;

    if (/^https?:\/\//i.test(String(identifier))) {
      return String(identifier).trim();
    }

    return `${this.baseUrl}/${mapped}`;
  }

  async fetchUserExpertise(identifier) {
    try {
      const cacheKey = this.normalizeKey(identifier);
      const cached = this.getCachedExpertise(cacheKey);
      if (cached) return cached;

      const result = await this.scrapeUserExpertise(identifier);
      this.setCachedExpertise(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error fetching expertise for ${identifier}:`, error.message);
      return [];
    }
  }

  async scrapeUserExpertise(identifier) {
    const directUrl = this.resolveProfileIdentifier(identifier);
    if (!directUrl) return [];

    const fallbackUrl = `${this.baseUrl}/profile/${this.normalizeKey(identifier)}`;
    const urlsToTry = [...new Set([directUrl, fallbackUrl])];

    for (const profileUrl of urlsToTry) {
      try {
        console.log(`🔍 Fetching expertise from: ${profileUrl}`);

        const response = await axios.get(profileUrl, {
          timeout: 12000,
          headers: {
            "User-Agent": "UTHM-ZKP-System/1.0 (Academic Research System)",
          },
        });

        if (response.status !== 200) continue;

        const parsed = this.parseProfile(response.data);
        const expertise = parsed.expertiseTags;

        if (expertise.length > 0) {
          console.log(`✅ Found ${expertise.length} expertise entries for ${identifier}`);
          return expertise;
        }
      } catch (error) {
        console.warn(`⚠️ Could not read ${profileUrl}: ${error.message}`);
      }
    }

    return [];
  }

  cleanLine(value = "") {
    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  addExpertise(target, value) {
    const cleaned = this.cleanLine(value)
      .replace(/^Field Category \(KPT\)\s*:\s*/i, "")
      .replace(/^Field \(KPT\)\s*:\s*/i, "")
      .replace(/^Field of Specialization \(KPT\)\s*:\s*/i, "")
      .replace(/^Category Expertise$/i, "")
      .trim();

    if (!cleaned) return;
    if (cleaned === "* * *") return;
    if (/^(FIELD OF EXPERTISE|AREAS OF RESEARCH INTEREST|INNOVATION FIELD OF INTEREST)$/i.test(cleaned)) return;
    if (/^(CONTACT DETAILS|PROFESSIONAL APPOINTMENTS|ACADEMIC QUALIFICATION|MANAGEMENT EXPERIENCE)$/i.test(cleaned)) return;
    if (cleaned.length < 2 || cleaned.length > 140) return;

    cleaned
      .split(/[,;|]/)
      .map((item) => this.cleanLine(item))
      .filter((item) => item.length >= 2 && item.length <= 100)
      .forEach((item) => target.add(item));
  }

  getLinesBetween(lines, startHeader, endHeaders = []) {
    const startIndex = lines.findIndex((line) =>
      line.toUpperCase() === startHeader.toUpperCase(),
    );

    if (startIndex === -1) return [];

    const endIndex = lines.findIndex((line, index) => {
      if (index <= startIndex) return false;
      return endHeaders.some(
        (header) => line.toUpperCase() === header.toUpperCase(),
      );
    });

    return lines.slice(startIndex + 1, endIndex === -1 ? lines.length : endIndex);
  }

  parseProfile(html) {
    const $ = cheerio.load(html);
    const bodyText = $("body").text();
    const lines = bodyText
      .split(/\n+/)
      .map((line) => this.cleanLine(line))
      .filter(Boolean);

    const expertise = new Set();

    const fieldLines = this.getLinesBetween(lines, "FIELD OF EXPERTISE", [
      "AREAS OF RESEARCH INTEREST",
      "INNOVATION FIELD OF INTEREST",
      "MANAGEMENT EXPERIENCE",
      "TEACHING EXPERIENCE",
    ]);

    const researchLines = this.getLinesBetween(lines, "AREAS OF RESEARCH INTEREST", [
      "INNOVATION FIELD OF INTEREST",
      "MANAGEMENT EXPERIENCE",
      "TEACHING EXPERIENCE",
    ]);

    const innovationLines = this.getLinesBetween(lines, "INNOVATION FIELD OF INTEREST", [
      "MANAGEMENT EXPERIENCE",
      "TEACHING EXPERIENCE",
      "RESEARCH GRANTS AND CONTRACTS",
      "PUBLICATIONS",
    ]);

    [...fieldLines, ...researchLines, ...innovationLines].forEach((line) => {
      if (/Field Category \(KPT\)\s*:/i.test(line)) return;
      this.addExpertise(expertise, line);
    });

    const profileName = lines.find((line) =>
      /^(PROF\.|PROF|DR\.|TS\.|IR\.|EN\.|PN\.)/i.test(line),
    );

    const professionalAppointment = lines.find((line) =>
      /^DS\d+\s+/i.test(line),
    );

    return {
      name: profileName || "",
      profession: professionalAppointment || "",
      expertiseTags: [...expertise],
    };
  }

  parseExpertiseFromHTML(html) {
    return this.parseProfile(html).expertiseTags;
  }

  getCachedExpertise(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCachedExpertise(key, expertise) {
    this.cache.set(key, {
      data: Array.isArray(expertise) ? expertise : [],
      timestamp: Date.now(),
    });
  }

  clearUserCache(identifier) {
    this.cache.delete(this.normalizeKey(identifier));
  }

  clearAllCache() {
    this.cache.clear();
  }
}

module.exports = new ExpertiseService();
