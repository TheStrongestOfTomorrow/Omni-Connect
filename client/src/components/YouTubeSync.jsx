import React, { useEffect, useRef, useState } from 'react';
import YouTubePlayer from 'youtube-player';

const YouTubeSync = ({ socket, isHost }) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [videoId, setVideoId] = useState('dQw4w9WgXcQ');

  useEffect(() => {
    playerRef.current = YouTubePlayer(containerRef.current);

    if (isHost) {
      const interval = setInterval(async () => {
        if (playerRef.current) {
          const state = await playerRef.current.getPlayerState();
          const time = await playerRef.current.getCurrentTime();
          socket.emit('media-sync', { videoId, time, state });
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      socket.on('media-sync', async (data) => {
        if (playerRef.current) {
          const currentTime = await playerRef.current.getCurrentTime();
          if (Math.abs(currentTime - data.time) > 0.1) {
            playerRef.current.seekTo(data.time, true);
          }
          if (data.state === 1) playerRef.current.playVideo();
          else if (data.state === 2) playerRef.current.pauseVideo();
        }
      });
    }
  }, [socket, isHost, videoId]);

  return (
    <div className="youtube-sync">
      <div ref={containerRef}></div>
      {isHost && (
        <input
          type="text"
          placeholder="YouTube Video ID"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
        />
      )}
    </div>
  );
};

export default YouTubeSync;
