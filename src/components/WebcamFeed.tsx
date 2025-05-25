
import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface WebcamFeedProps {
  onGestureDetected: (gesture: 'yes' | 'no') => void;
  onFaceData: (faces: any[], fps: number) => void;
  fallbackMode: boolean;
}

const WebcamFeed: React.FC<WebcamFeedProps> = ({ 
  onGestureDetected, 
  onFaceData, 
  fallbackMode 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastGesture, setLastGesture] = useState<string | null>(null);
  const fpsRef = useRef(30);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    initCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsLoading(false);
          startDetection();
        };
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const startDetection = () => {
    const detectFrame = () => {
      if (!videoRef.current || !canvasRef.current || fallbackMode) {
        requestAnimationFrame(detectFrame);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const video = videoRef.current;

      if (ctx && video.readyState === 4) {
        // Calculate FPS
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastTimeRef.current >= 1000) {
          fpsRef.current = frameCountRef.current;
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame
        ctx.drawImage(video, 0, 0);

        // Simulate face detection (in real implementation, use MediaPipe)
        const mockFaces = simulateFaceDetection();
        
        // Draw face overlays
        drawFaceOverlays(ctx, mockFaces);
        
        // Report data
        onFaceData(mockFaces, fpsRef.current);
      }

      requestAnimationFrame(detectFrame);
    };

    detectFrame();
  };

  const simulateFaceDetection = () => {
    // Mock face detection for demo purposes
    // In real implementation, integrate MediaPipe Face Mesh
    const mockFaces = [];
    
    if (!fallbackMode && Math.random() > 0.3) {
      mockFaces.push({
        id: 1,
        x: 200 + Math.random() * 100,
        y: 150 + Math.random() * 50,
        width: 120,
        height: 150,
        gesture: Math.random() > 0.7 ? (Math.random() > 0.5 ? 'yes' : 'no') : null,
        confidence: 0.8 + Math.random() * 0.2
      });
    }

    return mockFaces;
  };

  const drawFaceOverlays = (ctx: CanvasRenderingContext2D, faces: any[]) => {
    faces.forEach((face) => {
      // Draw face outline
      ctx.strokeStyle = face.gesture === 'yes' ? '#10b981' : 
                       face.gesture === 'no' ? '#ef4444' : '#6b7280';
      ctx.lineWidth = 4;
      ctx.strokeRect(face.x, face.y, face.width, face.height);

      // Trigger gesture callback
      if (face.gesture && face.gesture !== lastGesture) {
        setLastGesture(face.gesture);
        onGestureDetected(face.gesture);
        
        // Visual feedback
        if (face.gesture === 'yes') {
          drawCheckmark(ctx, face.x + face.width/2, face.y - 20);
        } else {
          drawX(ctx, face.x + face.width/2, face.y - 20);
        }
      }
    });
  };

  const drawCheckmark = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 5, y + 5);
    ctx.lineTo(x + 10, y - 10);
    ctx.stroke();
  };

  const drawX = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.moveTo(x + 8, y - 8);
    ctx.lineTo(x - 8, y + 8);
    ctx.stroke();
  };

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-700 p-8 text-center">
        <p className="text-red-400 text-lg">{error}</p>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="relative bg-black rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <div className="text-white">Loading camera...</div>
          </div>
        )}
        
        <video
          ref={videoRef}
          className="w-full h-auto max-h-96"
          autoPlay
          muted
          playsInline
        />
        
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: fallbackMode ? 'none' : 'block' }}
        />

        {fallbackMode && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-32 h-32 bg-white mb-4 mx-auto rounded-lg flex items-center justify-center">
                <div className="text-black font-mono text-xs">QR Code</div>
              </div>
              <p>Scan to join discussion</p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 flex justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
          <span className="text-green-400">Nod = YES</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <span className="text-red-400">Shake = NO</span>
        </div>
      </div>
    </div>
  );
};

export default WebcamFeed;
