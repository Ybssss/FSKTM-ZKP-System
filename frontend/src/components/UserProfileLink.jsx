import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getUserDisplayName, getUserProfileId } from "../utils/userProfile";

export default function UserProfileLink({
  user,
  children,
  fallback = "Unknown User",
  relationLabel = "",
  className = "",
  onClick,
}) {
  const { user: currentUser } = useAuth();
  const profileId = getUserProfileId(user);
  const label = children || getUserDisplayName(user, fallback);
  const basePath = currentUser?.role === "student" ? "/student" : "/panel";

  if (!profileId) {
    return (
      <span className={className}>
        {label}
        {relationLabel && (
          <span className="ml-1 align-middle rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700 border border-indigo-100">
            {relationLabel}
          </span>
        )}
      </span>
    );
  }

  return (
    <Link
      to={`${basePath}/users/${profileId}`}
      onClick={onClick}
      className={`inline-flex w-fit items-center gap-1 text-indigo-700 hover:text-indigo-900 hover:underline ${className}`}
    >
      <span>{label}</span>
      {relationLabel && (
        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700 border border-indigo-100 no-underline">
          {relationLabel}
        </span>
      )}
    </Link>
  );
}
