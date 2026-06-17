import React, { useState } from "react";

const normalizeProfileImageUrl = (value = "") => String(value || "").trim();

export default function UserAvatar({
  user,
  className = "",
  imgClassName = "w-full h-full object-cover",
  fallbackClassName = "w-full h-full flex items-center justify-center bg-gray-600 text-white font-semibold uppercase",
  alt,
}) {
  const imageUrl = normalizeProfileImageUrl(user?.profileImageUrl);
  const displayLabel = user?.name || user?.userId || user?.email || "User";
  const initial = String(displayLabel).trim().charAt(0).toUpperCase() || "U";
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const canRenderImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  return (
    <div className={className}>
      {canRenderImage ? (
        <img
          src={imageUrl}
          alt={alt || `${displayLabel} profile`}
          className={imgClassName}
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <div className={fallbackClassName}>{initial}</div>
      )}
    </div>
  );
}
