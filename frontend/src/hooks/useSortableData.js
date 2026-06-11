import { useMemo, useState } from "react";

export const normalizeSortValue = (value) => {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return String(value).normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
};

export const sortItems = (items = [], accessors = {}, sortConfig = {}) => {
  if (!sortConfig.key || !accessors[sortConfig.key]) return items;

  return [...items].sort((a, b) => {
    const aValue = normalizeSortValue(accessors[sortConfig.key](a));
    const bValue = normalizeSortValue(accessors[sortConfig.key](b));

    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });
};

export default function useSortableData(items = [], accessors = {}, initialSort = {}) {
  const [sortConfig, setSortConfig] = useState({
    key: initialSort.key || "",
    direction: initialSort.direction || "asc",
  });

  const requestSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedItems = useMemo(() => {
    return sortItems(items, accessors, sortConfig);
  }, [accessors, items, sortConfig]);

  return { sortedItems, sortConfig, requestSort };
}
