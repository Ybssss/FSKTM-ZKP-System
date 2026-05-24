const toSessionTypeCode = (value = "") =>
  String(value)
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/'/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 50);

module.exports = { toSessionTypeCode };
