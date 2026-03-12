import React, { useEffect, useState } from 'react';
import { db } from '../db';

const ImagePreview = ({ mediaKey }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const loadImage = async () => {
      const media = await db.media.get(mediaKey);
      if (media) {
        const imageUrl = URL.createObjectURL(media.blob);
        setUrl(imageUrl);
      }
    };
    loadImage();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaKey]);

  if (!url) return <div>Loading Image...</div>;

  return (
    <div className="image-preview">
      <img src={url} alt="Shared" style={{ maxWidth: '100%', borderRadius: '0.5rem' }} />
    </div>
  );
};

export default ImagePreview;
