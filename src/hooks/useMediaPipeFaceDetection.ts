import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

interface GestureDetection {
  gesture: 'yes' | 'no' | null;
  confidence: number;
  deltaX: number;
  deltaY: number;
}

export interface FaceData {
  id: number;
  landmarks: any[];
  rect: { x: number; y: number; width: number; height: number };
  gesture: 'yes' | 'no' | null;
  confidence: number;
  deltaX: number;
  deltaY: number;
  nose: { x: number; y: number };
  isInCooldown: boolean;
  lastGesture?: 'yes' | 'no' | null;
}

interface FaceDetectionResult {
  faces: FaceData[];
  fps: number;
  isLoading: boolean;
  error: string | null;
  isPreparing: boolean;
}

interface TrackedFace {
  id: number;
  centerX: number;
  centerY: number;
  lastSeen: number;
}

/**
 * Hook to manage MediaPipe FaceMesh detection & nod/shake gesture recognition.
 */
export const useMediaPipeFaceDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onGestureDetected: (gesture: 'yes' | 'no', faceId: number) => void,
  onConflictPair?: (pair: { yes: FaceData; no: FaceData }) => void,
  enabled: boolean = true,
  drawFaceBoxes: boolean = true,
  questionId?: number
): FaceDetectionResult => {
  const [result, setResult] = useState<FaceDetectionResult>({
    faces: [],
    fps: 0,
    isLoading: true,
    error: null,
    isPreparing: false,
  });

  const faceMeshRef = useRef<FaceMesh | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  // For FPS calculation
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  // Throttle detection to ~10 fps
  const DETECTION_INTERVAL = 100; // ms
  const lastDetectionTimeRef = useRef(performance.now());

  // Face tracking for stable IDs
  const trackedFacesRef = useRef<TrackedFace[]>([]);
  const nextFaceIdRef = useRef(1);
  const FACE_TRACKING_THRESHOLD = 100; // pixels
  const FACE_TIMEOUT_MS = 2000; // Remove faces not seen for 2 seconds

  // Gesture detection accumulators per face
  const previousNosePositionRef = useRef<Record<number, { x: number; y: number }>>({});
  const gestureHistoryMapRef = useRef<Record<number, GestureDetection[]>>({});
  const lastGestureTimeMapRef = useRef<Record<number, number>>({});
  const lastGesturePerFaceRef = useRef<Record<number, 'yes' | 'no' | null>>({});
  const preparingRef = useRef(false);
  const lastConflictTimeRef = useRef(0);

  // Reset gesture history when question changes
  useEffect(() => {
    previousNosePositionRef.current = {};
    gestureHistoryMapRef.current = {};
    lastGestureTimeMapRef.current = {};
    lastGesturePerFaceRef.current = {};
    preparingRef.current = false;
    lastConflictTimeRef.current = 0;
    // Also reset face tracking
    trackedFacesRef.current = [];
    nextFaceIdRef.current = 1;
  }, [questionId]);

  // Constants
  const REQUIRED_GESTURE_FRAMES = 6;
  const GESTURE_COOLDOWN_MS = 4000;
  const GESTURE_CONFIDENCE_THRESHOLD = 0.7;
  const NOD_THRESHOLD = 0.05;
  const SHAKE_THRESHOLD = 0.06;

  // -------------------------------
  // Face Tracking Functions
  // -------------------------------
  const computeFaceCenter = useCallback((landmarks: any[], width: number, height: number) => {
    const xs = landmarks.map((pt: any) => pt.x * width);
    const ys = landmarks.map((pt: any) => pt.y * height);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { centerX, centerY };
  }, []);

  const getStableFaceId = useCallback((landmarks: any[], width: number, height: number): number => {
    const { centerX, centerY } = computeFaceCenter(landmarks, width, height);
    const now = performance.now();

    // Clean up old faces that haven't been seen recently
    trackedFacesRef.current = trackedFacesRef.current.filter(face => 
      now - face.lastSeen < FACE_TIMEOUT_MS
    );

    // Try to match with existing tracked face
    for (const trackedFace of trackedFacesRef.current) {
      const distance = Math.sqrt(
        Math.pow(centerX - trackedFace.centerX, 2) + 
        Math.pow(centerY - trackedFace.centerY, 2)
      );

      if (distance < FACE_TRACKING_THRESHOLD) {
        // Update tracked face position and timestamp
        trackedFace.centerX = centerX;
        trackedFace.centerY = centerY;
        trackedFace.lastSeen = now;
        return trackedFace.id;
      }
    }

    // No match found, create new tracked face
    const newFace: TrackedFace = {
      id: nextFaceIdRef.current++,
      centerX,
      centerY,
      lastSeen: now
    };
    trackedFacesRef.current.push(newFace);
    return newFace.id;
  }, [computeFaceCenter, FACE_TRACKING_THRESHOLD, FACE_TIMEOUT_MS]);

  // -------------------------------
  // 1) computeFaceRect Helper
  // -------------------------------
  const computeFaceRect = useCallback((landmarks: any[], width: number, height: number) => {
    const xs = landmarks.map((pt: any) => pt.x * width);
    const ys = landmarks.map((pt: any) => pt.y * height);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX - 20,
      y: minY - 20,
      width: maxX - minX + 40,
      height: maxY - minY + 40,
    };
  }, []);

  // -------------------------------
  // 2) detectGestureFromLandmarks
  // -------------------------------
  const detectGestureFromLandmarks = useCallback(
    (landmarks: any[], faceId: number): GestureDetection | null => {
      const noseTip = landmarks[4];
      if (!noseTip) return null;

      const currentPos = { x: noseTip.x, y: noseTip.y };
      const prevPos = previousNosePositionRef.current[faceId];
      previousNosePositionRef.current[faceId] = currentPos;
      if (!prevPos) return null;

      const deltaX = Math.abs(currentPos.x - prevPos.x);
      const deltaY = Math.abs(currentPos.y - prevPos.y);

      let gesture: 'yes' | 'no' | null = null;
      let confidence = 0;

      // Horizontal => "no"
      if (deltaX > SHAKE_THRESHOLD && deltaX > deltaY * 1.2) {
        gesture = 'no';
        confidence = Math.min(deltaX / (SHAKE_THRESHOLD * 2), 1);
      }
      // Vertical => "yes"
      else if (deltaY > NOD_THRESHOLD && deltaY > deltaX * 1.2) {
        gesture = 'yes';
        confidence = Math.min(deltaY / (NOD_THRESHOLD * 2), 1);
      }

      if (gesture && confidence > GESTURE_CONFIDENCE_THRESHOLD) {
        return { gesture, confidence, deltaX, deltaY };
      }
      return { gesture: null, confidence, deltaX, deltaY };
    },
    [NOD_THRESHOLD, SHAKE_THRESHOLD, GESTURE_CONFIDENCE_THRESHOLD]
  );

  // -------------------------------
  // 3) processGestureHistory
  // -------------------------------
  const processGestureHistory = useCallback(
    (faceId: number) => {
      const history = gestureHistoryMapRef.current[faceId] || [];
      const len = history.length;
      if (len === 0) return;

      const recent = history.slice(-REQUIRED_GESTURE_FRAMES);
      const gestures = recent.map(r => r.gesture);
      const yesCount = gestures.filter(g => g === 'yes').length;
      const noCount = gestures.filter(g => g === 'no').length;
      const majority = Math.max(yesCount, noCount);

      if (len < REQUIRED_GESTURE_FRAMES && majority === len && !preparingRef.current) {
        preparingRef.current = true;
        setResult(prev => ({ ...prev, isPreparing: true }));
      }

      const now = performance.now();
      const lastTime = lastGestureTimeMapRef.current[faceId] || 0;

      if (len >= REQUIRED_GESTURE_FRAMES) {
        const avgConfidence =
          recent.reduce((sum, item) => sum + item.confidence, 0) / recent.length;
        if (
          now - lastTime > GESTURE_COOLDOWN_MS &&
          avgConfidence > GESTURE_CONFIDENCE_THRESHOLD
        ) {
          if (yesCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.9)) {
            onGestureDetected('yes', faceId);
            lastGestureTimeMapRef.current[faceId] = now;
            lastGesturePerFaceRef.current[faceId] = 'yes';
            gestureHistoryMapRef.current[faceId] = [];
            preparingRef.current = false;
            setResult(prev => ({ ...prev, isPreparing: false }));
          } else if (noCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.9)) {
            onGestureDetected('no', faceId);
            lastGestureTimeMapRef.current[faceId] = now;
            lastGesturePerFaceRef.current[faceId] = 'no';
            gestureHistoryMapRef.current[faceId] = [];
            preparingRef.current = false;
            setResult(prev => ({ ...prev, isPreparing: false }));
          }
        }
      }

      if (preparingRef.current && majority !== len) {
        preparingRef.current = false;
        setResult(prev => ({ ...prev, isPreparing: false }));
      }
    },
    [
      onGestureDetected,
      REQUIRED_GESTURE_FRAMES,
      GESTURE_COOLDOWN_MS,
      GESTURE_CONFIDENCE_THRESHOLD
    ]
  );

  // -------------------------------
  // 4) onResults callback
  // -------------------------------
  const onResults = useCallback(
    (results: any) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // FPS
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        const fpsCalc = frameCountRef.current;
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
        setResult(prev => ({ ...prev, fps: fpsCalc }));
      }

      if (results.multiFaceLandmarks?.length) {
        const newFaces: FaceData[] = results.multiFaceLandmarks.map((landmarks: any) => {
          // Get stable face ID
          const faceId = getStableFaceId(landmarks, canvas.width, canvas.height);
          
          const gestureResult = detectGestureFromLandmarks(landmarks, faceId);
          if (gestureResult) {
            if (!gestureHistoryMapRef.current[faceId]) gestureHistoryMapRef.current[faceId] = [];
            if (gestureResult.gesture) {
              gestureHistoryMapRef.current[faceId].push(gestureResult);
              const maxSize = REQUIRED_GESTURE_FRAMES * 2;
              if (gestureHistoryMapRef.current[faceId].length > maxSize) {
                gestureHistoryMapRef.current[faceId] = gestureHistoryMapRef.current[faceId].slice(-maxSize);
              }
            }
          }

          const rect = computeFaceRect(landmarks, canvas.width, canvas.height);
          const timeSinceGesture = now - (lastGestureTimeMapRef.current[faceId] || 0);
          const isInCooldown = timeSinceGesture < GESTURE_COOLDOWN_MS;

          if (drawFaceBoxes) {
            const fade = isInCooldown
              ? 1 - timeSinceGesture / GESTURE_COOLDOWN_MS
              : 1;
            
            // Get color based on this specific face's last gesture
            let color = '128,128,128'; // Default gray
            const persistentGesture = lastGesturePerFaceRef.current[faceId];
            if (persistentGesture === 'yes') color = '0,255,0'; // Green for yes
            else if (persistentGesture === 'no') color = '255,0,0'; // Red for no

            ctx.save();
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(${color},${fade})`;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            
            // Add face ID label for debugging
            ctx.fillStyle = `rgba(${color},${fade})`;
            ctx.font = '16px Arial';
            ctx.fillText(`Face ${faceId}`, rect.x, rect.y - 5);
            
            ctx.restore();
          }

          return {
            id: faceId,
            landmarks,
            rect,
            gesture: gestureResult?.gesture || null,
            confidence: gestureResult?.confidence || 0,
            deltaX: gestureResult?.deltaX || 0,
            deltaY: gestureResult?.deltaY || 0,
            nose: { x: landmarks[4].x, y: landmarks[4].y },
            isInCooldown,
            lastGesture: lastGesturePerFaceRef.current[faceId] || null,
          };
        });

        setResult(prev => ({
          ...prev,
          faces: newFaces,
          isLoading: false,
          error: null
        }));

        // Process gesture history for each face
        newFaces.forEach(face => {
          processGestureHistory(face.id);
        });

        // Handle conflict detection between faces with different votes
        const yesFaces = newFaces.filter(f => lastGesturePerFaceRef.current[f.id] === 'yes');
        const noFaces = newFaces.filter(f => lastGesturePerFaceRef.current[f.id] === 'no');

        if (yesFaces.length && noFaces.length) {
          // Draw connection lines between conflicting faces
          yesFaces.forEach(yf => {
            noFaces.forEach(nf => {
              ctx.save();
              ctx.strokeStyle = 'cyan';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(yf.rect.x + yf.rect.width / 2, yf.rect.y + yf.rect.height / 2);
              ctx.lineTo(nf.rect.x + nf.rect.width / 2, nf.rect.y + nf.rect.height / 2);
              ctx.stroke();
              ctx.restore();
            });
          });

          // Trigger conflict callback with rate limiting
          if (onConflictPair) {
            const nowTime = performance.now();
            if (nowTime - lastConflictTimeRef.current > GESTURE_COOLDOWN_MS) {
              lastConflictTimeRef.current = nowTime;
              onConflictPair({ yes: yesFaces[0], no: noFaces[0] });
            }
          }
        }
      } else {
        setResult(prev => ({ ...prev, faces: [], isLoading: false }));
      }
    },
    [
      canvasRef,
      getStableFaceId,
      computeFaceRect,
      detectGestureFromLandmarks,
      processGestureHistory,
      REQUIRED_GESTURE_FRAMES,
      GESTURE_COOLDOWN_MS,
      drawFaceBoxes,
      onConflictPair,
    ]
  );

  // -------------------------------
  // 5) useEffect: init FaceMesh + Camera
  // -------------------------------
  useEffect(() => {
    // If disabled, shut everything down
    if (!enabled) {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
      setResult(prev => ({ ...prev, faces: [], fps: 0, isLoading: true }));
      return;
    }

    async function initMediaPipe() {
      try {
        if (faceMeshRef.current) {
          faceMeshRef.current.close();
          faceMeshRef.current = null;
        }
        const faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
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
          if (cameraRef.current) {
            cameraRef.current.stop();
            cameraRef.current = null;
          }

          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (!faceMeshRef.current || !videoRef.current) return;
              const timeNow = performance.now();
              // Throttle detection calls
              if (timeNow - lastDetectionTimeRef.current > DETECTION_INTERVAL) {
                lastDetectionTimeRef.current = timeNow;
                await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 480,
            height: 360
          });
          await camera.start();
          cameraRef.current = camera;
          setResult(prev => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error('MediaPipe initialization error:', err);
        setResult(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to initialize MediaPipe FaceMesh or camera.'
        }));
      }
    }

    initMediaPipe();

    // Cleanup on unmount or toggling "enabled"
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
    };
  }, [enabled, onResults, videoRef]);

  return result;
};