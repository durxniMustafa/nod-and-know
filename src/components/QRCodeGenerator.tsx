import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Smartphone, Wifi, Copy, RefreshCw } from 'lucide-react';

interface QRCodeGeneratorProps {
  currentQuestion: string;
  roomId: string;
  ngrokUrl?: string;
  onMobileUserJoined?: (userId: string) => void;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  currentQuestion, 
  roomId, 
  ngrokUrl = "https://your-ngrok-url.ngrok.io",
  onMobileUserJoined 
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mobileUsers, setMobileUsers] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate chat room URL
  const generateChatUrl = () => {
    const encodedQuestion = encodeURIComponent(currentQuestion);
    const chatUrl = `${ngrokUrl}/mobile-chat?room=${roomId}&question=${encodedQuestion}&timestamp=${Date.now()}`;
    return chatUrl;
  };

  // Generate QR code
  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const chatUrl = generateChatUrl();
      // Use free QR code API
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(chatUrl)}`;
      setQrCodeUrl(qrApiUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy link to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateChatUrl());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Listen for mobile users joining
  useEffect(() => {
    // Simulate listening to WebSocket connections
    const checkMobileUsers = () => {
      // This should integrate with your websocket service
      // websocketService.onMobileUserJoined((userId) => {
      //   setMobileUsers(prev => [...prev, userId]);
      //   onMobileUserJoined?.(userId);
      // });
    };

    checkMobileUsers();
  }, [onMobileUserJoined]);

  // Regenerate QR code when question changes
  useEffect(() => {
    generateQRCode();
  }, [currentQuestion, roomId, ngrokUrl]);

  return (
    <Card className="bg-gradient-to-br from-gray-900/95 to-black/95 border border-cyan-500/30 p-6 backdrop-blur-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <QrCode className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Mobile Join</h3>
          <p className="text-sm text-gray-400">Scan QR code or copy link</p>
        </div>
      </div>

      {/* QR code display area */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative p-4 bg-white rounded-xl shadow-lg">
          {isGenerating ? (
            <div className="w-48 h-48 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <img 
              src={qrCodeUrl} 
              alt="QR Code for mobile chat"
              className="w-48 h-48 object-contain"
            />
          )}
          
          {/* Decorative border */}
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur opacity-75"></div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 w-full">
          <Button
            onClick={copyToClipboard}
            variant="outline"
            className="flex-1 bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 text-white"
          >
            <Copy className="w-4 h-4 mr-2" />
            {copySuccess ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button
            onClick={generateQRCode}
            variant="outline"
            className="bg-cyan-600/20 border-cyan-500/50 hover:bg-cyan-600/30 text-cyan-300"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-300">QR code valid</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="text-gray-300">{mobileUsers.length} mobile users</span>
          </div>
        </div>

        {/* Usage instructions */}
        <div className="bg-gray-800/50 rounded-lg p-4 w-full">
          <h4 className="text-sm font-medium text-cyan-300 mb-2 flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            How to Use
          </h4>
          <ol className="text-xs text-gray-400 space-y-1">
            <li>1. Scan the QR code with your phone camera</li>
            <li>2. Or copy the link and send it to your phone</li>
            <li>3. Open the link in your phone browser</li>
            <li>4. Join the discussion anonymously</li>
          </ol>
        </div>

        {/* Current question preview */}
        <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg p-3 w-full border border-cyan-500/20">
          <div className="text-xs text-cyan-300 mb-1">Current Discussion Topic:</div>
          <div className="text-sm text-white font-medium leading-relaxed">
            {currentQuestion}
          </div>
        </div>

        {/* Connected mobile devices list */}
        {mobileUsers.length > 0 && (
          <div className="w-full">
            <h4 className="text-sm font-medium text-white mb-2">Connected Mobile Devices</h4>
            <div className="flex flex-wrap gap-2">
              {mobileUsers.map((userId, index) => (
                <Badge 
                  key={userId} 
                  variant="outline" 
                  className="text-green-400 border-green-400/50 bg-green-400/10"
                >
                  <Smartphone className="w-3 h-3 mr-1" />
                  Mobile User {index + 1}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default QRCodeGenerator;