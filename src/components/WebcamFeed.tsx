
import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useMediaPipeFaceDetection } from '@/hooks/useMediaPipeFaceDetection';

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Use the MediaPipe face detection hook
  const { faces, fps, isLoading, error } = useMediaPipeFaceDetection(
    videoRef,
    canvasRef,
    onGestureDetected
  );

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraStream(stream);
          setCameraError(null);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError('Camera access denied. Please allow camera permissions and refresh the page.');
      }
    };

    if (!fallbackMode) {
      initCamera();
    }

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [fallbackMode]);

  // Report face data to parent
  useEffect(() => {
    onFaceData(faces, fps);
  }, [faces, fps, onFaceData]);

  // Handle canvas sizing
  useEffect(() => {
    if (canvasRef.current && videoRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const updateCanvasSize = () => {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      };

      video.addEventListener('loadedmetadata', updateCanvasSize);
      return () => video.removeEventListener('loadedmetadata', updateCanvasSize);
    }
  }, []);

  if (cameraError || error) {
    return (
      <Card className="bg-red-900/20 border-red-700 p-8 text-center">
        <div className="space-y-4">
          <div className="text-red-400 text-lg font-semibold">Camera Error</div>
          <p className="text-red-300">{cameraError || error}</p>
          <div className="text-sm text-red-200">
            <p>To fix this:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Allow camera permissions in your browser</li>
              <li>Ensure no other applications are using your camera</li>
              <li>Try refreshing the page</li>
            </ul>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="relative bg-black rounded-lg overflow-hidden">
        {(isLoading || !videoRef.current) && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
            <div className="text-white space-y-2 text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>Initializing camera...</div>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          className="w-full h-auto max-h-96"
          autoPlay
          muted
          playsInline
          style={{ display: fallbackMode ? 'none' : 'block' }}
        />
        
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: fallbackMode ? 'none' : 'block' }}
        />

        {fallbackMode && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center min-h-[300px]">
            <div className="text-center text-white space-y-4">
              <div className="w-32 h-32 bg-white mb-4 mx-auto rounded-lg flex items-center justify-center">
                <div className="text-black font-mono text-xs">
                  <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">Scan to Join Discussion</p>
                <p className="text-sm text-gray-300">Camera detection unavailable</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status and Instructions */}
      <div className="mt-4 space-y-3">
        {/* Real-time status */}
        {!fallbackMode && (
          <div className="flex justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${faces.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-gray-300">
                {faces.length} face{faces.length !== 1 ? 's' : ''} detected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${fps > 15 ? 'bg-green-500' : fps > 10 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-300">
                {Math.round(fps)} FPS
              </span>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="flex justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-green-400">Nod = YES</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-red-400">Shake = NO</span>
          </div>
        </div>

        {/* Gesture cooldown indicator */}
        {faces.some(face => face.isInCooldown) && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-900/20 border border-yellow-600 rounded-lg">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span className="text-yellow-400 text-sm">Processing gesture...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebcamFeed;
