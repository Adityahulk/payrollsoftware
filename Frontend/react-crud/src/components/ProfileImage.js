import React, { useEffect, useState } from "react";
import apiClient from "../api/client";

const ProfileImage = ({ empId, previewUrl, hasPhoto, style }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (previewUrl) {
      setImageUrl(previewUrl);
      setHasError(false);
      return;
    }

    if (!empId || hasPhoto === false) {
      setImageUrl(null);
      setHasError(false);
      return;
    }

    let isMounted = true;
    let objectUrl = null;

    const fetchImage = async () => {
      try {
        const res = await apiClient.get(`/Profile/photo/${empId}`, {
          responseType: "blob",
        });

        if (!isMounted) return;

        objectUrl = URL.createObjectURL(res.data);
        setImageUrl(objectUrl);
        setHasError(false);
      } catch (err) {
        if (isMounted) {
          const isCancel = err.name === "CanceledError" || 
                           err.message === "Component unmounted" || 
                           err.message?.includes("Duplicate request cancelled");
          if (!isCancel) {
            console.error("Image load failed", err);
            setHasError(true);
          }
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [empId, previewUrl, hasPhoto]);

  if (hasError || (!imageUrl && !previewUrl)) {
    const iconSize = style?.width ? parseInt(style.width) / 2 : 48;
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gray-100)',
        width: style?.width || '100%',
        height: style?.height || '100%',
        color: 'var(--gray-400)',
        borderRadius: style?.borderRadius || '50%'
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: iconSize }}>person</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Profile"
      style={style || {
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
};

export default ProfileImage;
