import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useMediaPipeFaceDetection } from '@/hooks/useMediaPipeFaceDetection';

interface WebcamFeedProps {
  onGestureDetected: (gesture: 'yes' | 'no', faceId: number) => void;
  onFaceData: (faces: any[], fps: number) => void;
  onConflictPair?: (pair: { yes: any; no: any }) => void;
  fallbackMode: boolean;
  debugMode?: boolean;
  showOutlines?: boolean;
  /** Current question index used to reset overlay colors */
  questionId: number;
  nodThreshold: number;
  shakeThreshold: number;
  phase: 'question' | 'results';
}

interface HeadPose {
  pitch: number;
  yaw: number;
  roll: number;
}

interface ExtendedFaceData {
  id: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  nose: {
    x: number;
    y: number;
  };
  deltaX: number;
  deltaY: number;
  gesture?: string;
  confidence: number;
  isInCooldown?: boolean;
  headPose?: HeadPose;
}

const WebcamFeed: React.FC<WebcamFeedProps> = ({
  onGestureDetected,
  onFaceData,
  onConflictPair,
  fallbackMode,
  debugMode = false,
  showOutlines = true,
  questionId,
  nodThreshold,
  shakeThreshold,
  phase
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [headPoseData, setHeadPoseData] = useState<HeadPose | null>(null);

  const handleConflictFromHook = React.useCallback(
    (pair: { yes: any; no: any }) => {
      onConflictPair?.(pair);
    },
    [onConflictPair]
  );

  // Use our MediaPipe detection hook (enabled = !fallbackMode)
  const { faces, fps, isLoading, error, isPreparing } = useMediaPipeFaceDetection(
    videoRef,
    canvasRef,
    onGestureDetected,
    handleConflictFromHook,
    !fallbackMode,
    showOutlines,
    questionId,
    nodThreshold,
    shakeThreshold,
    phase
  );

  // Clear camera error when we exit fallback
  useEffect(() => {
    if (!fallbackMode) {
      setCameraError(null);
    }
  }, [fallbackMode]);

  // Report face data + track head pose
  useEffect(() => {
    onFaceData(faces, fps);
    
    if (faces.length > 0) {
      const firstFace = faces[0] as ExtendedFaceData;
      if (firstFace && 'headPose' in firstFace && firstFace.headPose) {
        setHeadPoseData(firstFace.headPose);
      } else {
        setHeadPoseData(null);
      }
    } else {
      setHeadPoseData(null);
    }
  }, [faces, fps, onFaceData]);

  // Resize canvas after video metadata loads
  useEffect(() => {
    if (canvasRef.current && videoRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const updateCanvasSize = () => {
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 360;
      };

      video.addEventListener('loadedmetadata', updateCanvasSize);
      return () => video.removeEventListener('loadedmetadata', updateCanvasSize);
    }
  }, []);

  // Show any error states
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

  const hasCooldownProperty = (face: any): face is { isInCooldown: boolean } => {
    return face && typeof face.isInCooldown === 'boolean';
  };

  // Render camera + overlays
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

        {/* Debug overlay with face details */}
        {debugMode && !fallbackMode && (
          <div className="absolute top-0 left-0 bg-black/70 text-white text-xs p-2 space-y-1 max-h-60 overflow-y-auto">
            {faces.map(face => (
              <div
                key={face.id}
                className="border-b border-gray-600 pb-1 mb-1 last:border-none last:mb-0"
              >
                <div>Face {face.id}</div>
                <div>
                  Rect: {face.rect?.x?.toFixed(0) ?? 'N/A'}, {face.rect?.y?.toFixed(0) ?? 'N/A'}, 
                  {face.rect?.width?.toFixed(0) ?? 'N/A'}x{face.rect?.height?.toFixed(0) ?? 'N/A'}
                </div>
                <div>Nose: {face.nose?.x?.toFixed(2) ?? 'N/A'}, {face.nose?.y?.toFixed(2) ?? 'N/A'}</div>
                <div>Δx: {face.deltaX?.toFixed(3) ?? 'N/A'} Δy: {face.deltaY?.toFixed(3) ?? 'N/A'}</div>
                {face.gesture && (
                  <div>
                    Gesture: {face.gesture} ({face.confidence?.toFixed(2) ?? 'N/A'})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {fallbackMode && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center min-h-[300px]">
            <div className="text-center text-white space-y-4">
              <div className="w-32 h-32 bg-white mb-4 mx-auto rounded-lg flex items-center justify-center">
                <div className="text-black font-mono text-xs">
                  {/* Example random pattern */}
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

      {/* Status/Instructions */}
      <div className="mt-4 space-y-3">
        {/* {!fallbackMode && (
          <div className="flex justify-center gap-4 text-sm mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  faces.length > 0 ? 'bg-green-500' : 'bg-gray-500'
                }`}
              />
              <span className="text-gray-300">
                {faces.length} face{faces.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  fps > 15 ? 'bg-green-500' : fps > 10 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              />
              <span className="text-gray-300">{Math.round(fps)} FPS</span>
            </div>
          </div>
        )} */}

        {!fallbackMode && headPoseData && faces.length > 0 && (
          <div className="text-center bg-gray-800 p-2 rounded-md mb-3 text-xs text-gray-300">
            <h4 className="font-semibold mb-1 text-sm text-white">Head Pose (Face 1):</h4>
            <div>Pitch: {headPoseData.pitch?.toFixed(2) ?? 'N/A'}</div>
            <div>Yaw: {headPoseData.yaw?.toFixed(2) ?? 'N/A'}</div>
            <div>Roll: {headPoseData.roll?.toFixed(2) ?? 'N/A'}</div>
          </div>
        )}

        {phase === 'question' && (
          <div className="flex justify-center gap-8 text-base md:text-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full" />
              <span className="text-green-400">Nod for YES</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full" />
              <span className="text-red-400">Shake for NO</span>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default WebcamFeed;