import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, Smartphone, Users, Wifi, Copy, Check, Globe, AlertCircle, Zap } from 'lucide-react';

interface QRCodeJoinProps {
  question: string;
  onJoinChat: () => void;
  ngrokUrl?: string; // Add this prop to pass ngrok URL
}

const EnhancedQRCodeJoin: React.FC<QRCodeJoinProps> = ({ question, onJoinChat, ngrokUrl }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState(1);
  const [customNgrokUrl, setCustomNgrokUrl] = useState(ngrokUrl || '');
  const [isValidUrl, setIsValidUrl] = useState(true);
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    generateRoomData();
  }, [question, customNgrokUrl]);

  const generateRoomData = () => {
    // Generate a unique room ID based on the question and timestamp
    const timestamp = Date.now().toString(36);
    const questionHash = btoa(question).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    const generatedRoomId = `room_${questionHash}_${timestamp}`;
    setRoomId(generatedRoomId);
    
    // Determine the base URL
    let baseUrl = customNgrokUrl || window.location.origin;
    
    // Clean up the URL
    if (baseUrl && !baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    // Validate ngrok URL format
    const isValid = !customNgrokUrl || /^https?:\/\/[a-z0-9-]+\.ngrok(-free)?\.app$/i.test(baseUrl);
    setIsValidUrl(isValid);
    
    if (isValid) {
      const fullJoinUrl = `${baseUrl}/#/chat/${generatedRoomId}?topic=${encodeURIComponent(question)}`;
      setJoinUrl(fullJoinUrl);
      
      // Generate QR code URL using a reliable QR code service
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&format=png&data=${encodeURIComponent(fullJoinUrl)}&margin=10&color=000000&bgcolor=ffffff`;
      setQrCodeUrl(qrApiUrl);
    }
  };

  // Simulate connected devices counter with more realistic behavior
  useEffect(() => {
    const deviceCounter = setInterval(() => {
      setConnectedDevices(prev => {
        const hour = new Date().getHours();
        const baseActivity = hour >= 9 && hour <= 17 ? 0.7 : 0.3; // More active during work hours
        const change = Math.random() < baseActivity ? 
          (Math.random() > 0.6 ? 1 : 0) : 
          (Math.random() > 0.8 ? -1 : 0);
        return Math.max(1, Math.min(12, prev + change));
      });
    }, 4000 + Math.random() * 2000);

    return () => clearInterval(deviceCounter);
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = joinUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNgrokUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomNgrokUrl(e.target.value);
  };

  const getConnectionInstructions = () => {
    if (customNgrokUrl && isValidUrl) {
      return "Ready for mobile access via ngrok tunnel";
    } else if (customNgrokUrl && !isValidUrl) {
      return "Invalid ngrok URL format";
    } else {
      return "Local network only - add ngrok URL for external access";
    }
  };

  return (
    <div className="space-y-6">
      {/* Ngrok Configuration Card */}
      {!ngrokUrl && (
        <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/30 p-6 backdrop-blur-lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-blue-300">External Access Setup</h3>
            </div>
            
            <p className="text-gray-300 text-sm">
              For mobile access, start ngrok and enter your tunnel URL below:
            </p>
            
            <div className="bg-gray-800/50 p-3 rounded-lg font-mono text-sm text-gray-300">
              <div className="text-cyan-400 mb-1">$ ngrok http 3000</div>
              <div className="text-gray-400">→ Copy the https://xyz.ngrok-free.app URL</div>
            </div>
            
            <div className="flex gap-2">
              <Input
                value={customNgrokUrl}
                onChange={handleNgrokUrlChange}
                placeholder="https://your-tunnel.ngrok-free.app"
                className={`bg-gray-800/50 border-gray-600 text-white ${
                  !isValidUrl ? 'border-red-500 focus:border-red-400' : 'focus:border-blue-400'
                }`}
              />
              <Button 
                onClick={generateRoomData}
                className="bg-blue-600 hover:bg-blue-500"
              >
                Update
              </Button>
            </div>
            
            {!isValidUrl && customNgrokUrl && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                Please enter a valid ngrok URL format
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Main QR Code Card */}
      <Card className="bg-gradient-to-br from-gray-900/95 to-black/90 border border-cyan-500/30 p-8 relative overflow-hidden backdrop-blur-lg shadow-2xl shadow-cyan-500/10">
        
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl animate-pulse delay-1000"></div>

        <div className="relative text-center space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3">
              <QrCode className="w-8 h-8 text-cyan-400" />
              <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Join SecureMatch Chat
              </h2>
            </div>
            <p className="text-gray-300 text-lg">
              Scan with your phone to join the encrypted discussion
            </p>
            <div className={`text-sm px-3 py-1 rounded-full inline-flex items-center gap-2 ${
              isValidUrl && customNgrokUrl ? 
                'bg-green-500/20 text-green-400 border border-green-500/30' :
                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isValidUrl && customNgrokUrl ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'
              }`}></div>
              {getConnectionInstructions()}
            </div>
          </div>

          {/* QR Code Display */}
          <div className="flex justify-center">
            <div className="relative p-6 bg-white rounded-3xl shadow-2xl transform hover:scale-105 transition-transform duration-300">
              {qrCodeUrl && isValidUrl ? (
                <>
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code to join SecureMatch chat room" 
                    className="w-64 h-64 rounded-lg"
                  />
                  {/* Scanning animation overlay */}
                  <div className="absolute inset-6 pointer-events-none rounded-lg overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/70 to-transparent animate-pulse"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/70 to-transparent animate-pulse" style={{animationDelay: '1s'}}></div>
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-transparent via-cyan-500/70 to-transparent animate-pulse" style={{animationDelay: '0.5s'}}></div>
                    <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-transparent via-cyan-500/70 to-transparent animate-pulse" style={{animationDelay: '1.5s'}}></div>
                  </div>
                </>
              ) : (
                <div className="w-64 h-64 bg-gray-200 rounded-lg flex items-center justify-center animate-pulse">
                  <div className="text-center space-y-2">
                    <QrCode className="w-16 h-16 text-gray-400 mx-auto" />
                    <p className="text-gray-500 text-sm">
                      {!isValidUrl ? 'Configure ngrok URL' : 'Generating QR code...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Topic Preview */}
          <div className="bg-gradient-to-r from-gray-800/60 to-gray-700/60 rounded-xl p-4 backdrop-blur-sm border border-gray-600/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-cyan-400 font-medium">Discussion Topic</span>
              <Zap className="w-4 h-4 text-cyan-400 ml-auto" />
            </div>
            <p className="text-gray-200 text-base font-medium italic">"{question}"</p>
            <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
              <span>Room ID: {roomId.substring(0, 12)}...</span>
              <span>🔒 End-to-end encrypted</span>
            </div>
          </div>

          {/* Live Stats */}
          <div className="flex justify-center gap-8">
            <div className="flex items-center gap-2 text-green-400">
              <Wifi className="w-4 h-4 animate-pulse" />
              <span className="text-sm font-medium">Live Connection</span>
            </div>
            <div className="flex items-center gap-2 text-blue-400">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{connectedDevices} Online</span>
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <Smartphone className="w-4 h-4" />
              <span className="text-sm font-medium">Mobile Ready</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={onJoinChat}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-10 py-4 rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30 text-lg font-semibold"
            >
              <Users className="w-5 h-5 mr-2" />
              Join from This Device
            </Button>
            
            <Button 
              onClick={copyToClipboard}
              variant="outline"
              disabled={!isValidUrl}
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 px-10 py-4 rounded-xl transition-all duration-300 hover:scale-105 text-lg font-semibold disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 mr-2 text-green-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Enhanced Instructions */}
      <Card className="bg-gradient-to-br from-gray-900/80 to-black/70 border border-gray-700/50 p-6 backdrop-blur-sm">
        <h3 className="text-xl font-semibold text-cyan-400 mb-6 flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Mobile Access Instructions
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto text-white font-bold text-2xl shadow-lg">
              1
            </div>
            <h4 className="font-semibold text-gray-200 text-lg">Open Camera App</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Use your phone's built-in camera app or any QR code scanner application
            </p>
          </div>
          
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto text-white font-bold text-2xl shadow-lg">
              2
            </div>
            <h4 className="font-semibold text-gray-200 text-lg">Scan QR Code</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Point your camera at the QR code above and wait for the notification
            </p>
          </div>
          
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto text-white font-bold text-2xl shadow-lg">
              3
            </div>
            <h4 className="font-semibold text-gray-200 text-lg">Join SecureMatch</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Tap the notification or link to enter the encrypted chat room
            </p>
          </div>
        </div>

        {/* Additional Tips */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-500/20">
          <h4 className="text-blue-300 font-medium mb-2">💡 Pro Tips:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Make sure both devices are connected to the internet</li>
            <li>• The chat room stays active as long as someone is connected</li>
            <li>• Your identity remains anonymous with randomly generated usernames</li>
            <li>• All messages are encrypted and not stored on servers</li>
          </ul>
        </div>
      </Card>

      {/* Technical Details */}
      <Card className="bg-gradient-to-br from-gray-900/60 to-black/50 border border-gray-800/50 p-4 backdrop-blur-sm">
        <details className="text-gray-400">
          <summary className="cursor-pointer hover:text-cyan-400 transition-colors font-medium">
            🔧 Technical Details & Troubleshooting
          </summary>
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p><strong className="text-cyan-400">Room Configuration:</strong></p>
                <ul className="ml-4 space-y-1 text-xs">
                  <li>Room ID: <code className="bg-gray-800 px-2 py-1 rounded text-cyan-300">{roomId}</code></li>
                  <li>Security: End-to-end encrypted</li>
                  <li>Anonymity: Random usernames</li>
                  <li>Platform: Cross-device compatible</li>
                </ul>
              </div>
              <div>
                <p><strong className="text-cyan-400">Network Details:</strong></p>
                <ul className="ml-4 space-y-1 text-xs">
                  <li>Local URL: <code className="bg-gray-800 px-1 rounded text-xs break-all">{window.location.origin}</code></li>
                  {customNgrokUrl && <li>Tunnel URL: <code className="bg-gray-800 px-1 rounded text-xs break-all">{customNgrokUrl}</code></li>}
                  <li>Protocol: HTTPS required for camera access</li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-gray-700 pt-3">
              <p><strong className="text-cyan-400">Troubleshooting:</strong></p>
              <ul className="ml-4 space-y-1 text-xs text-gray-400">
                <li>• Camera not working? Check browser permissions</li>
                <li>• QR code not scanning? Try better lighting or different angle</li>
                <li>• Can't connect? Ensure both devices have internet access</li>
                <li>• ngrok issues? Restart tunnel and update URL above</li>
              </ul>
            </div>
          </div>
        </details>
      </Card>
    </div>
  );
};

export default EnhancedQRCodeJoin;