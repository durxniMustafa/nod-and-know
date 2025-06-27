import { useSearchParams, useNavigate } from 'react-router-dom';
import ChatInterface from '@/components/ChatInterface';

const ChatPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const question = params.get('q') || 'Security discussion';

  return (
    <ChatInterface
      question={decodeURIComponent(question)}
      onClose={() => navigate('/')}
    />
  );
};

export default ChatPage;
