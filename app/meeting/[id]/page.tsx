'use client';

import { useEffect, useState } from 'react';
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
import { Mic, MicOff, Video, VideoOff, MonitorUp, LogOut } from 'lucide-react';

async function fetchStreamToken(userId: string): Promise<string> {
  console.log('Fetching Stream token for userId:', userId); // Debug
  const response = await fetch('/api/stream-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Stream token: ${response.statusText}`);
  }
  const { token } = await response.json();
  console.log('Stream token fetched:', token); // Debug
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token payload:', payload); // Debug: Verify user_id
  } catch (err) {
    console.error('Error decoding token:', err);
  }
  return token;
}

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, isLoaded } = useUser();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Unwrap params using React.use()
  const { id } = use(params);

  useEffect(() => {
    if (!isLoaded) {
      console.log('Clerk user is not loaded yet'); // Debug
      return;
    }

    if (!user) {
      console.log('No user found'); // Debug
      setError('User not authenticated');
      return;
    }

    console.log('Initializing Stream client for user:', user.id); // Debug

    const initClient = async () => {
      try {
        const client = new StreamVideoClient({ apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY! });
        console.log('StreamVideoClient initialized'); // Debug

        // Fetch Stream token for the user
        const token = await fetchStreamToken(user.id);

        // Connect the user to Stream
        console.log('Attempting to connect user to Stream'); // Debug
        await client.connectUser(
          {
            id: user.id,
            name: user.fullName || user.username || 'Anonymous',
            image: user.imageUrl,
          },
          token
        );
        console.log('User connected to Stream'); // Debug

        setClient(client);

        // Join the call
        const call = client.call('default', id);
        console.log('Joining call with ID:', id); // Debug
        await call.join({ create: true });
        console.log('Call joined successfully'); // Debug
        setCall(call);
      } catch (err: any) {
        console.error('Error in initClient:', err); // Debug
        if (err.message.includes('WS connection')) {
          setError('Failed to connect to Stream servers. Check API key or network.');
        } else {
          setError(`Failed to initialize meeting: ${err.message}`);
        }
      }
    };

    initClient();

    // Cleanup on unmount
    return () => {
      if (call) {
        console.log('Leaving call'); // Debug
        call.leave();
      }
      if (client) {
        console.log('Disconnecting client'); // Debug
        client.disconnectUser();
      }
    };
  }, [user, isLoaded, id]);

  // Meeting controls
  const toggleMicrophone = async () => {
    if (call) {
      await call.microphone.toggle();
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCamera = async () => {
    if (call) {
      await call.camera.toggle();
      setIsCameraOn(!isCameraOn);
    }
  };

  const toggleScreenShare = async () => {
    if (call) {
      if (isScreenSharing) {
        await call.stopScreenShare();
      } else {
        await call.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    }
  };

  const leaveCall = () => {
    if (call) {
      call.leave();
    }
    window.location.href = '/'; // Redirect to home
  };

  if (!isLoaded) {
    return <div className="text-white bg-gray-900 h-screen flex items-center justify-center">Loading user data...</div>;
  }

  if (error) {
    return <div className="text-red-500 bg-gray-900 h-screen flex items-center justify-center">{error}</div>;
  }

  if (!client || !call) {
    return <div className="text-white bg-gray-900 h-screen flex items-center justify-center">Loading meeting...</div>;
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <div className="h-screen bg-gray-900 text-white flex flex-col">
          {/* Video Grid */}
          <div className="flex-1 p-4 overflow-auto">
            <div
              className={`grid gap-4 ${
                call.state.participants.length === 1
                  ? 'grid-cols-1'
                  : call.state.participants.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              }`}
            >
              {call.state.participants.map((participant: StreamVideoParticipant) => (
                <div key={participant.sessionId} className="relative">
                  <ParticipantView
                    participant={participant}
                    className="w-full h-48 md:h-64 lg:h-80 rounded-lg"
                  />
                  <span className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
                    {participant.name || 'Anonymous'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Control Bar */}
          <div className="bg-gray-800 p-4 flex justify-center gap-4">
            <button
              onClick={toggleMicrophone}
              className={`p-3 rounded-full ${
                isMicOn ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600 hover:bg-red-500'
              }`}
              title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
            >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-full ${
                isCameraOn ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600 hover:bg-red-500'
              }`}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-full ${
                isScreenSharing ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'
              }`}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <MonitorUp size={24} />
            </button>
            <button
              onClick={leaveCall}
              className="p-3 rounded-full bg-red-600 hover:bg-red-500"
              title="Leave call"
            >
              <LogOut size={24} />
            </button>
          </div>
        </div>
      </StreamCall>
    </StreamVideo>
  );
}