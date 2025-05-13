import { StreamChat } from 'stream-chat';
import { SignJWT } from 'jose';

const streamApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const streamSecret = process.env.STREAM_SECRET_KEY!;

export const streamClient = StreamChat.getInstance(streamApiKey, streamSecret);

export async function generateStreamToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(streamSecret);
  const token = await new SignJWT({ user_id: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
  return token;
}