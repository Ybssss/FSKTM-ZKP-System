export default function SortableTh({
  children,
  sortKey,
  sortConfig,
  onSort,
  className = "",
}) {
  const active = sortConfig?.key === sortKey;
  const arrow = active ? (sortConfig.direction === "asc" ? "^" : "v") : "<>";
  const ariaSort = !active
    ? "none"
    : sortConfig.direction === "asc"
      ? "ascending"
      : "descending";

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex w-full items-center justify-between gap-2 text-left hover:text-indigo-700 transition-colors"
      >
        <span>{children}</span>
        <span
          aria-hidden="true"
          className={`text-[10px] ${active ? "text-indigo-700" : "text-gray-400"}`}
        >
          {arrow}
        </span>
      </button>
    </th>
  );
}
