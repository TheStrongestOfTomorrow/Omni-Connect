import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { Play, Pause } from 'lucide-react';

const AudioPlayer = ({ mediaKey }) => {
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef(new Audio());

  useEffect(() => {
    const loadAudio = async () => {
      const media = await db.media.get(mediaKey);
      if (media) {
        const audioUrl = URL.createObjectURL(media.blob);
        setUrl(audioUrl);
        audioRef.current.src = audioUrl;
      }
    };
    loadAudio();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaKey]);

  const togglePlay = () => {
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  audioRef.current.onended = () => setPlaying(false);

  return (
    <div className="audio-player">
      <button onClick={togglePlay}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="waveform">Voice Message</div>
    </div>
  );
};

export default AudioPlayer;
