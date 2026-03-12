import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, Monitor, X } from 'lucide-react';

const StreamHandler = ({ peer, targetUuid, isHost }) => {
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  const startMedia = async (type) => {
    try {
      let newStream;
      if (type === 'camera') {
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } else if (type === 'screen') {
        newStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      }
      setStream(newStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

      if (targetUuid && peer) {
        const call = peer.call(targetUuid, newStream);
        call.on('stream', (rStream) => {
          setRemoteStream(rStream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
        });
      }
    } catch (err) {
      console.error('Failed to get media:', err);
    }
  };

  useEffect(() => {
    if (peer) {
      peer.on('call', (call) => {
        call.answer(stream);
        call.on('stream', (rStream) => {
          setRemoteStream(rStream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
        });
      });
    }
  }, [peer, stream]);

  const stopMedia = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
    <div className="stream-handler">
      <div className="media-controls">
        <button onClick={() => startMedia('camera')} title="Camera"><Camera size={20} /></button>
        <button onClick={() => startMedia('screen')} title="Share Screen"><Monitor size={20} /></button>
        <button onClick={stopMedia} title="Stop"><X size={20} /></button>
      </div>
      <div className="video-grid">
        {stream && <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />}
        {remoteStream && <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />}
      </div>
    </div>
  );
};

export default StreamHandler;
