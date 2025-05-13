'use client';

import { useEffect, useState } from 'react';
import { StreamVideo, StreamVideoClient } from '@stream-io/video-react-sdk';

export default function TestStream() {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initClient = async () => {
      try {
        const client = new StreamVideoClient({
          apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY!,
          logLevel: 'debug',
        });
        await client.connectUser(
          { id: 'test-user', name: 'Test User' },
          'your-hardcoded-token' // From Stream dashboard
        );
        setClient(client);
      } catch (err: any) {
        setError(`Failed: ${err.message}`);
      }
    };
    initClient();
    return () => client?.disconnectUser();
  }, []);

  if (error) return <div className="text-red-500">{error}</div>;
  if (!client) return <div>Loading...</div>;

  return (
    <StreamVideo client={client}>
      <div>Test Stream Client Connected</div>
    </StreamVideo>
  );
}