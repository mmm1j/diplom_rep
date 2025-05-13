'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function Home() {
  const [meetingId, setMeetingId] = useState('');
  const router = useRouter();

  const handleJoinMeeting = () => {
    if (meetingId) {
      router.push(`/meeting/${meetingId}`);
    }
  };

  const handleStartMeeting = () => {
    const newMeetingId = Math.random().toString(36).substring(2, 10);
    router.push(`/meeting/${newMeetingId}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <header className="mb-8">
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton />
        </SignedOut>
      </header>
      <main className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-4 text-center">Zoom Clone</h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <SignedIn>
            <button
              onClick={handleStartMeeting}
              className="w-full bg-blue-600 text-white py-2 rounded mb-4 hover:bg-blue-700"
            >
              Start New Meeting
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="Enter Meeting ID"
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={handleJoinMeeting}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Join
              </button>
            </div>
          </SignedIn>
          <SignedOut>
            <p className="text-center">Please sign in to start or join a meeting.</p>
          </SignedOut>
        </div>
      </main>
    </div>
  );
}