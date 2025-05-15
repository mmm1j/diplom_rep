'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantView,
  StreamVideoParticipant,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { use } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, LogOut, Copy } from 'lucide-react';
import styles from './meeting.module.css';

async function fetchStreamToken(userId: string): Promise<string> {
  console.log('Fetching Stream token for userId:', userId);
  const response = await fetch('/api/stream-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Stream token: ${response.statusText}`);
  }
  const { token } = await response.json();
  console.log('Stream token fetched:', token);
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token payload:', payload);
  } catch (err) {
    console.error('Error decoding token:', err);
  }
  return token;
}

// Check camera permissions with timeout and silent handling for in-use cases
async function checkCameraPermissions(): Promise<{ hasAccess: boolean; errorMessage?: string }> {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Camera access timeout')), 1000);
    });
    const streamPromise = navigator.mediaDevices.getUserMedia({ video: true });
    const stream = await Promise.race([streamPromise, timeoutPromise]);
    stream.getTracks().forEach(track => track.stop());
    return { hasAccess: true };
  } catch (err: any) {
    console.error('Camera access error:', err);
    if (err.name === 'NotAllowedError') {
      return { hasAccess: false, errorMessage: 'Camera access denied. Please allow camera permissions in your browser settings.' };
    } else if (err.name === 'OverconstrainedError' || err.name === 'NotReadableError' || err.message === 'Camera access timeout') {
      return { hasAccess: false }; // Silently handle camera in use
    }
    return { hasAccess: false, errorMessage: 'Failed to access camera. Please check your device and permissions.' };
  }
}

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, isLoaded } = useUser();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [copyTooltip, setCopyTooltip] = useState('Copy meeting ID');

  const { id } = use(params);

  useEffect(() => {
    if (!isLoaded) {
      console.log('Clerk user is not loaded yet');
      return;
    }

    if (!user) {
      console.log('No user found');
      setError('User not authenticated. Please sign in.');
      return;
    }

    console.log('Initializing Stream client for user:', user.id);

    const initClient = async () => {
      try {
        const client = new StreamVideoClient({
          apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY!,
          logLevel: 'debug',
        });
        console.log('StreamVideoClient initialized');

        const token = await fetchStreamToken(user.id);

        console.log('Attempting to connect user to Stream');
        await client.connectUser(
          {
            id: user.id,
            name: user.fullName || user.username || 'Anonymous',
            image: user.imageUrl,
          },
          token
        );
        console.log('User connected to Stream');

        setClient(client);

        const call = client.call('default', id);

        const { hasAccess, errorMessage } = await checkCameraPermissions();
        if (errorMessage) {
          setCameraError(errorMessage);
          setIsCameraOn(false);
        } else if (!hasAccess) {
          setIsCameraOn(false); // Camera in use, join silently
        }

        console.log('Joining call with ID:', id);
        try {
          await call.join({ create: true, video: hasAccess ? undefined : false });
          console.log('Call joined successfully');
          setCall(call);

          if (hasAccess) {
            try {
              await call.camera.enable();
              setIsCameraOn(true);
            } catch (err) {
              console.error('Failed to enable camera post-join:', err);
              setCameraError('Failed to enable camera. Ensure no other app is using it.');
            }
          }
        } catch (joinErr) {
          console.error('Failed to join call:', joinErr);
          setError('Failed to join the meeting. Please check your network settings.');
        }
      } catch (err: any) {
        console.error('Error in initClient:', err);
        if (err.message.includes('WS connection') && retryCount < 3) {
          console.log(`Retrying connection (attempt ${retryCount + 1}/3)`);
          setTimeout(() => setRetryCount(retryCount + 1), 2000);
        } else if (err.message.includes('WS connection')) {
          setError(
            'Cannot connect to Stream servers. Verify your Stream API key, network, or contact Stream support.'
          );
        } else {
          setError(`Failed to initialize meeting: ${err.message}`);
        }
      }
    };

    initClient();

    return () => {
      if (call) {
        console.log('Leaving call');
        call.leave();
      }
      if (client) {
        console.log('Disconnecting client');
        client.disconnectUser();
      }
    };
  }, [user, isLoaded, id, retryCount]);

  const toggleMicrophone = async () => {
    if (call) {
      try {
        await call.microphone.toggle();
        setIsMicOn(!isMicOn);
      } catch (err) {
        console.error('Failed to toggle microphone:', err);
        setError('Failed to toggle microphone. Please try again.');
      }
    }
  };

  const toggleCamera = async () => {
    if (!call) return;

    const { hasAccess, errorMessage } = await checkCameraPermissions();
    if (!hasAccess) {
      if (errorMessage) {
        setCameraError(errorMessage);
      }
      return;
    }

    try {
      await call.camera.toggle();
      setIsCameraOn(!isCameraOn);
      setCameraError(null);
    } catch (err) {
      console.error('Failed to toggle camera:', err);
      setCameraError('Failed to access camera. Ensure no other app is using it and permissions are granted.');
    }
  };

  const toggleScreenShare = async () => {
    if (call) {
      try {
        if (isScreenSharing) {
          await call.stopScreenShare();
        } else {
          await call.startScreenShare();
        }
        setIsScreenSharing(!isScreenSharing);
      } catch (err) {
        console.error('Failed to toggle screen share:', err);
        setError('Failed to toggle screen sharing. Please try again.');
      }
    }
  };

  const leaveCall = () => {
    if (call) {
      call.leave();
    }
    window.location.href = '/';
  };

  const copyMeetingId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopyTooltip('Copied!');
      setTimeout(() => setCopyTooltip('Copy meeting ID'), 2000);
    } catch (err) {
      console.error('Failed to copy meeting ID:', err);
      setError('Failed to copy meeting ID. Please try again.');
    }
  };

  // Deduplicate participants by userId
  const participants = useMemo(() => {
    if (!call) return [];
    const seen = new Map<string, StreamVideoParticipant>();
    call.state.participants.forEach((p: StreamVideoParticipant) => {
      if (!p.userId) {
        console.warn('Skipping participant with missing userId:', p);
        return;
      }
      if (!seen.has(p.userId) || p.sessionId > (seen.get(p.userId)?.sessionId || '')) {
        seen.set(p.userId, p);
      }
    });
    const uniqueParticipants = Array.from(seen.values());
    console.log('Unique participants:', uniqueParticipants.map(p => ({
      userId: p.userId,
      sessionId: p.sessionId,
      name: p.name,
      isLocal: p.isLocalParticipant,
    })));
    return uniqueParticipants;
  }, [call?.state.participants]);

  if (!isLoaded) {
    return (
      <div className={styles.loading}>
        <div className={styles.loader}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorMessage}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className={styles.errorButton}
        >
          Retry
        </button>
        <a
          href="https://getstream.io/support"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.errorLink}
        >
          Contact Stream Support
        </a>
      </div>
    );
  }

  if (!client || !call) {
    return (
      <div className={styles.loading}>
        <div className={styles.loader}></div>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <div className={styles.container}>
          {/* Camera Error Message */}
          {cameraError && (
            <div className={styles.cameraError}>
              <p>{cameraError}</p>
              <button
                onClick={() => window.location.reload()}
                className={styles.errorButton}
              >
                Retry Camera
              </button>
            </div>
          )}

          {/* Video Grid */}
          <div className={styles.videoGridContainer}>
            <div
              className={`${styles.videoGrid} ${
                participants.length === 1
                  ? styles.videoGridOne
                  : participants.length === 2
                  ? styles.videoGridTwo
                  : styles.videoGridMultiple
              }`}
            >
              {participants.map((participant: StreamVideoParticipant) => (
                <div
                  key={participant.userId}
                  className={styles.participantContainer}
                >
                  <ParticipantView
                    participant={participant}
                    className={styles.participantView}
                  />
                  <span className={styles.participantName}>
                    {participant.name || 'Anonymous'}
                  </span>
                  <div className={styles.participantStatus}>
                    {participant.audioLevel > 0 ? (
                      <Mic className={styles.statusIcon} />
                    ) : (
                      <MicOff className={styles.statusIcon} />
                    )}
                    {participant.isLocalParticipant || participant.videoStream ? (
                      <Video className={styles.statusIcon} />
                    ) : (
                      <VideoOff className={styles.statusIcon} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Control Bar */}
          <div className={styles.controlBar}>
            <div className="group">
              <button
                onClick={toggleMicrophone}
                className={`${styles.button} ${
                  isMicOn ? styles.buttonMicOn : styles.buttonMicOff
                }`}
              >
                {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <span className={styles.tooltip}>
                {isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
              </span>
            </div>
            <div className="group">
              <button
                onClick={toggleCamera}
                className={`${styles.button} ${
                  isCameraOn ? styles.buttonCameraOn : styles.buttonCameraOff
                }`}
              >
                {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <span className={styles.tooltip}>
                {isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              </span>
            </div>
            <div className="group">
              <button
                onClick={toggleScreenShare}
                className={`${styles.button} ${
                  isScreenSharing ? styles.buttonScreenShareOn : styles.buttonScreenShareOff
                }`}
              >
                <MonitorUp size={20} />
              </button>
              <span className={styles.tooltip}>
                {isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
              </span>
            </div>
            <div className="group">
              <button
                onClick={copyMeetingId}
                className={`${styles.button} ${styles.buttonCopy}`}
              >
                <Copy size={20} />
              </button>
              <span className={styles.tooltip}>{copyTooltip}</span>
            </div>
            <div className="group">
              <button
                onClick={leaveCall}
                className={`${styles.button} ${styles.buttonLeave}`}
              >
                <LogOut size={20} />
              </button>
              <span className={styles.tooltip}>Leave call</span>
            </div>
          </div>
        </div>
      </StreamCall>
    </StreamVideo>
  );
}