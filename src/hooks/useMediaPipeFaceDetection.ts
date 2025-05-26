import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

interface FaceDetectionResult {
  faces: any[];
  fps: number;
  isLoading: boolean;
  error: string | null;
  /** Indicates a gesture is in progress but not yet confirmed */
  isPreparing: boolean;
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
  // Throttle detection calls to ~10 fps
  const DETECTION_INTERVAL = 100; // ms

  const [result, setResult] = useState<FaceDetectionResult>({
    faces: [],
    fps: 0,
    isLoading: true,
    error: null,
    isPreparing: false
  });

  const faceMeshRef = useRef<FaceMesh | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  // For FPS calculation
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  // Throttle detection
  const lastDetectionTimeRef = useRef(0);

  // Gesture detection stuff
  const gestureHistoryRef = useRef<GestureDetection[]>([]);
  const lastGestureTimeRef = useRef(0);
  const previousNosePositionRef = useRef<{ x: number; y: number } | null>(null);
  const preparingRef = useRef(false);

  // Constants for gesture logic
  const GESTURE_COOLDOWN_MS = 4000;
  const GESTURE_CONFIDENCE_THRESHOLD = 0.7;
  const REQUIRED_GESTURE_FRAMES = 6;
  const NOD_THRESHOLD = 0.05;
  const SHAKE_THRESHOLD = 0.06;

  // -- Helper to detect nod/shake from nose positions
  const detectGesture = useCallback((landmarks: any) => {
    if (!landmarks || landmarks.length === 0) return null;

    // Use nose tip landmark (index 4) for head movement detection
    const noseTip = landmarks[4];
    const currentNosePosition = { x: noseTip.x, y: noseTip.y };

    if (previousNosePositionRef.current) {
      const deltaX = Math.abs(currentNosePosition.x - previousNosePositionRef.current.x);
      const deltaY = Math.abs(currentNosePosition.y - previousNosePositionRef.current.y);

      let gesture: 'yes' | 'no' | null = null;
      let confidence = 0;

      // Detect head shake (horizontal)
      if (deltaX > SHAKE_THRESHOLD && deltaX > deltaY * 1.2) {
        gesture = 'no';
        confidence = Math.min(deltaX / (SHAKE_THRESHOLD * 2), 1);
      }
      // Detect head nod (vertical)
      else if (deltaY > NOD_THRESHOLD && deltaY > deltaX * 1.2) {
        gesture = 'yes';
        confidence = Math.min(deltaY / (NOD_THRESHOLD * 2), 1);
      }

      // Update the stored position
      previousNosePositionRef.current = currentNosePosition;

      if (gesture && confidence > GESTURE_CONFIDENCE_THRESHOLD) {
        return { gesture, confidence };
      }
    } else {
      previousNosePositionRef.current = currentNosePosition;
    }

    return null;
  }, []);

  // -- Gesture aggregator
  const processGestureHistory = useCallback(() => {
    const len = gestureHistoryRef.current.length;
    if (len === 0) {
      if (preparingRef.current) {
        preparingRef.current = false;
        setResult(prev => ({ ...prev, isPreparing: false }));
      }
      return;
    }

    const recentGestures = gestureHistoryRef.current.slice(-REQUIRED_GESTURE_FRAMES);
    const gestureTypes = recentGestures.map(g => g.gesture);
    const yesCount = gestureTypes.filter(g => g === 'yes').length;
    const noCount = gestureTypes.filter(g => g === 'no').length;
    const majority = Math.max(yesCount, noCount);
    const now = Date.now();
    const timeSinceLastGesture = now - lastGestureTimeRef.current;

    // If we see a full set of same-gesture frames, switch to "preparing" UI
    if (len < REQUIRED_GESTURE_FRAMES && majority === len && !preparingRef.current) {
      preparingRef.current = true;
      setResult(prev => ({ ...prev, isPreparing: true }));
    }

    // Once we have enough frames to confirm a gesture
    if (len >= REQUIRED_GESTURE_FRAMES) {
      const avgConfidence = recentGestures.reduce((sum, g) => sum + g.confidence, 0) / recentGestures.length;
      if (timeSinceLastGesture > GESTURE_COOLDOWN_MS && avgConfidence > GESTURE_CONFIDENCE_THRESHOLD) {
        if (yesCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.9)) {
          onGestureDetected('yes');
          lastGestureTimeRef.current = now;
          gestureHistoryRef.current = [];
          preparingRef.current = false;
          setResult(prev => ({ ...prev, isPreparing: false }));
        } else if (noCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.9)) {
          onGestureDetected('no');
          lastGestureTimeRef.current = now;
          gestureHistoryRef.current = [];
          preparingRef.current = false;
          setResult(prev => ({ ...prev, isPreparing: false }));
        }
      }
    }

    // If we started "preparing" but see conflicting frames, reset
    if (preparingRef.current && majority !== len) {
      preparingRef.current = false;
      setResult(prev => ({ ...prev, isPreparing: false }));
    }
  }, [onGestureDetected]);

  // -- Called every time FaceMesh has results
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
          // Keep only recent gesture frames to avoid memory growth
          const maxSize = REQUIRED_GESTURE_FRAMES * 2;
          if (gestureHistoryRef.current.length > maxSize) {
            gestureHistoryRef.current = gestureHistoryRef.current.slice(-maxSize);
          }
        }

        // Draw face outline
        const faceRect = getFaceRect(landmarks, canvas.width, canvas.height);
        const timeSinceLastGesture = now - lastGestureTimeRef.current;
        const isInCooldown = timeSinceLastGesture < GESTURE_COOLDOWN_MS;
        
        // Color depends on whether in cooldown or just recognized a gesture
        let color = '#6b7280'; // Default gray
        if (isInCooldown) {
          color = '#fbbf24'; // Yellow during cooldown
        } else if (gestureResult) {
          color = gestureResult.gesture === 'yes' ? '#10b981' : '#ef4444';
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(faceRect.x, faceRect.y, faceRect.width, faceRect.height);
        ctx.fillStyle = color;
        ctx.font = '16px sans-serif';
        ctx.fillText('tracking', faceRect.x, faceRect.y - 6);

        // Nose tip overlay
        const noseTipLandmark = landmarks[4];
        const noseCanvasX = noseTipLandmark.x * canvas.width;
        const noseCanvasY = noseTipLandmark.y * canvas.height;
        ctx.beginPath();
        ctx.arc(noseCanvasX, noseCanvasY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // If in cooldown, draw an arc to indicate time left
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
      // No faces
      setResult(prev => ({ ...prev, faces: [], isLoading: false }));
    }
  }, [detectGesture, processGestureHistory, canvasRef]);

  // -- Helper to get bounding box of face
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

  // -- Initialize FaceMesh + Camera
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
            // Called on every camera frame
            onFrame: async () => {
              if (faceMeshRef.current && videoRef.current) {
                const now = performance.now();
                // Throttle detection calls
                if (now - lastDetectionTimeRef.current > DETECTION_INTERVAL) {
                  lastDetectionTimeRef.current = now;
                  await faceMeshRef.current.send({ image: videoRef.current });
                }
              }
            },
            // Match our reduced resolution
            width: 480,
            height: 360
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
  }, [onResults, videoRef, canvasRef]);

  return result;
};
