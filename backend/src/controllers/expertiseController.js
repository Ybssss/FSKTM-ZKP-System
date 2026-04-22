// controllers/expertiseController.js
const axios = require("axios");
const cheerio = require("cheerio");

exports.getPanelExpertise = async (req, res) => {
  try {
    const { panelName } = req.query;
    if (!panelName)
      return res.status(400).json({ error: "Panel name is required" });

    // Fetch the HTML from UTHM Community directory
    const targetUrl = `https://community.uthm.edu.my/search?q=${encodeURIComponent(panelName)}`;
    const response = await axios.get(targetUrl);
    const $ = cheerio.load(response.data);

    let expertiseTags = [];

    // FIX: Using the exact HTML structure you provided
    // We look for the table row (tr), then extract the text inside the table data (td)
    $("table.table-striped tbody tr").each((index, element) => {
      // The <td> contains the actual expertise string (e.g., "Software Engineering")
      const expertiseText = $(element).find("td").text().trim();

      if (expertiseText) {
        // Split by comma in case they have multiple tags in one row, and clean up whitespace
        const tags = expertiseText.split(",").map((tag) => tag.trim());
        expertiseTags.push(...tags);
      }
    });

    res.status(200).json({
      panelName,
      expertiseTags, // Returns: ["INFORMATION, COMPUTER...", "Software", "Software Engineering"]
    });
  } catch (error) {
    console.error("Scraping error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch data from UTHM Community." });
  }
};
