import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

interface FaceDetectionResult {
  faces: any[];
  fps: number;
  isLoading: boolean;
  error: string | null;
}

interface GestureDetection {
  gesture: 'yes' | 'no' | null;
  confidence: number;
}

export const useMediaPipeFaceDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onGestureDetected: (gesture: 'yes' | 'no') => void
) => {
  const [result, setResult] = useState<FaceDetectionResult>({
    faces: [],
    fps: 0,
    isLoading: true,
    error: null
  });

  const faceMeshRef = useRef<FaceMesh | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const gestureHistoryRef = useRef<GestureDetection[]>([]);
  const lastGestureTimeRef = useRef(0);
  const previousNosePositionRef = useRef<{ x: number; y: number } | null>(null);

  const GESTURE_COOLDOWN_MS = 2500;
  const GESTURE_CONFIDENCE_THRESHOLD = 0.7;
  const REQUIRED_GESTURE_FRAMES = 4;
  const NOD_THRESHOLD = 0.03;
  const SHAKE_THRESHOLD = 0.04;

  const detectGesture = useCallback((landmarks: any) => {
    if (!landmarks || landmarks.length === 0) return null;

    // Use nose tip landmark (index 1) for head movement detection
    const noseTip = landmarks[1];
    const currentNosePosition = { x: noseTip.x, y: noseTip.y };

    if (previousNosePositionRef.current) {
      const deltaX = Math.abs(currentNosePosition.x - previousNosePositionRef.current.x);
      const deltaY = Math.abs(currentNosePosition.y - previousNosePositionRef.current.y);

      let gesture: 'yes' | 'no' | null = null;
      let confidence = 0;

      // Detect head shake (horizontal movement)
      if (deltaX > SHAKE_THRESHOLD && deltaX > deltaY * 1.5) {
        gesture = 'no';
        confidence = Math.min(deltaX / (SHAKE_THRESHOLD * 2), 1);
      }
      // Detect head nod (vertical movement)
      else if (deltaY > NOD_THRESHOLD && deltaY > deltaX * 1.5) {
        gesture = 'yes';
        confidence = Math.min(deltaY / (NOD_THRESHOLD * 2), 1);
      }

      previousNosePositionRef.current = currentNosePosition;

      if (gesture && confidence > GESTURE_CONFIDENCE_THRESHOLD) {
        return { gesture, confidence };
      }
    } else {
      previousNosePositionRef.current = currentNosePosition;
    }

    return null;
  }, []);

  const processGestureHistory = useCallback(() => {
    if (gestureHistoryRef.current.length < REQUIRED_GESTURE_FRAMES) return;

    const recentGestures = gestureHistoryRef.current.slice(-REQUIRED_GESTURE_FRAMES);
    const gestureTypes = recentGestures.map(g => g.gesture);
    const avgConfidence = recentGestures.reduce((sum, g) => sum + g.confidence, 0) / recentGestures.length;

    // Check if we have consistent gesture detection
    const yesCount = gestureTypes.filter(g => g === 'yes').length;
    const noCount = gestureTypes.filter(g => g === 'no').length;

    const now = Date.now();
    const timeSinceLastGesture = now - lastGestureTimeRef.current;

    if (timeSinceLastGesture > GESTURE_COOLDOWN_MS && avgConfidence > GESTURE_CONFIDENCE_THRESHOLD) {
      if (yesCount >= REQUIRED_GESTURE_FRAMES * 0.75) {
        onGestureDetected('yes');
        lastGestureTimeRef.current = now;
        gestureHistoryRef.current = [];
      } else if (noCount >= REQUIRED_GESTURE_FRAMES * 0.75) {
        onGestureDetected('no');
        lastGestureTimeRef.current = now;
        gestureHistoryRef.current = [];
      }
    }
  }, [onGestureDetected]);

  const onResults = useCallback((results: any) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate FPS
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastTimeRef.current >= 1000) {
      const fps = frameCountRef.current;
      frameCountRef.current = 0;
      lastTimeRef.current = now;
      
      setResult(prev => ({ ...prev, fps }));
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const faces = results.multiFaceLandmarks.map((landmarks: any, index: number) => {
        // Detect gesture for this face
        const gestureResult = detectGesture(landmarks);
        
        if (gestureResult) {
          gestureHistoryRef.current.push(gestureResult);
          // Keep only recent gesture history
          if (gestureHistoryRef.current.length > REQUIRED_GESTURE_FRAMES * 2) {
            gestureHistoryRef.current = gestureHistoryRef.current.slice(-REQUIRED_GESTURE_FRAMES);
          }
        }

        // Draw face outline
        const faceRect = getFaceRect(landmarks, canvas.width, canvas.height);
        const timeSinceLastGesture = now - lastGestureTimeRef.current;
        const isInCooldown = timeSinceLastGesture < GESTURE_COOLDOWN_MS;
        
        let color = '#6b7280'; // Default gray
        if (isInCooldown) {
          color = '#fbbf24'; // Yellow during cooldown
        } else if (gestureResult) {
          color = gestureResult.gesture === 'yes' ? '#10b981' : '#ef4444';
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(faceRect.x, faceRect.y, faceRect.width, faceRect.height);

        // Draw cooldown indicator
        if (isInCooldown) {
          const cooldownProgress = timeSinceLastGesture / GESTURE_COOLDOWN_MS;
          const arcRadius = 20;
          ctx.beginPath();
          ctx.arc(faceRect.x + faceRect.width - 30, faceRect.y + 30, arcRadius, 0, 2 * Math.PI * cooldownProgress);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        return {
          id: index,
          landmarks,
          rect: faceRect,
          gesture: gestureResult?.gesture || null,
          confidence: gestureResult?.confidence || 0,
          isInCooldown
        };
      });

      setResult(prev => ({ ...prev, faces, isLoading: false, error: null }));
      processGestureHistory();
    } else {
      setResult(prev => ({ ...prev, faces: [], isLoading: false }));
    }
  }, [detectGesture, processGestureHistory]);

  const getFaceRect = (landmarks: any, canvasWidth: number, canvasHeight: number) => {
    const xs = landmarks.map((point: any) => point.x * canvasWidth);
    const ys = landmarks.map((point: any) => point.y * canvasHeight);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX - 20,
      y: minY - 20,
      width: maxX - minX + 40,
      height: maxY - minY + 40
    };
  };

  useEffect(() => {
    const initializeMediaPipe = async () => {
      try {
        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 4,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onResults);
        faceMeshRef.current = faceMesh;

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (faceMeshRef.current && videoRef.current) {
                await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480
          });

          await camera.start();
          cameraRef.current = camera;
          setResult(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('MediaPipe initialization error:', error);
        setResult(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Failed to initialize camera. Please check permissions.' 
        }));
      }
    };

    initializeMediaPipe();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [onResults]);

  return result;
};
