import React from 'react';
import { useSearchParams } from 'react-router-dom';
import MobileChatPage from '@/components/mobileChatPage';

const MobileChat: React.FC = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  const question = searchParams.get('question');

  return (
    <MobileChatPage 
      roomId={roomId || undefined}
      question={question || undefined}
    />
  );
};

export default MobileChat;