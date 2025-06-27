import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import QRCode from 'qrcode';

interface AnswerOverlayProps {
  open: boolean;
  recommendedAnswer: string;
  timeRemaining: number;
  duration: number;
}

const AnswerOverlay: React.FC<AnswerOverlayProps> = ({ open, recommendedAnswer, timeRemaining, duration }) => {
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (open) {
      QRCode.toDataURL(window.location.href).then(setQr).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const progress = (duration - timeRemaining) / duration;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-700 text-gray-100 p-6 text-center space-y-4">
        <h3 className="text-2xl font-semibold">Recommended Answer</h3>
        <p className="text-xl">{recommendedAnswer}</p>
        {qr && <img src={qr} alt="QR code" className="mx-auto w-40 h-40" />}
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-1000"
            style={{ width: `${progress * 100}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-300">Next question in {timeRemaining}s</p>
      </Card>
    </div>
  );
};

export default AnswerOverlay;
