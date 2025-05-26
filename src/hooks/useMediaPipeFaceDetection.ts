import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

interface GestureDetection {
  gesture: 'yes' | 'no' | null;
  confidence: number;
  deltaX: number;
  deltaY: number;
}

interface FaceData {
  id: number;
  landmarks: any[];
  rect: { x: number; y: number; width: number; height: number };
  gesture: 'yes' | 'no' | null;
  confidence: number;
  deltaX: number;
  deltaY: number;
  nose: { x: number; y: number };
  isInCooldown: boolean;
}

interface FaceDetectionResult {
  faces: FaceData[];
  fps: number;
  isLoading: boolean;
  error: string | null;
  isPreparing: boolean;
}

/**
 * Hook to manage MediaPipe FaceMesh detection & nod/shake gesture recognition.
 */
export const useMediaPipeFaceDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onGestureDetected: (gesture: 'yes' | 'no') => void,
  enabled: boolean = true
): FaceDetectionResult => {
  // --------------------------------------------------------------------------------
  // 1) STATE + REFS
  // --------------------------------------------------------------------------------
  const [result, setResult] = useState<FaceDetectionResult>({
    faces: [],
    fps: 0,
    isLoading: true,
    error: null,
    isPreparing: false,
  });

  const faceMeshRef = useRef<FaceMesh | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  // For FPS calculations
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  // Throttle detection calls to ~10 fps
  const DETECTION_INTERVAL = 100; // ms
  const lastDetectionTimeRef = useRef(performance.now());

  // Gesture detection accumulators
  const gestureHistoryRef = useRef<GestureDetection[]>([]);
  const lastGestureTimeRef = useRef(performance.now());
  const previousNosePositionRef = useRef<{ x: number; y: number } | null>(null);
  const preparingRef = useRef(false);

  // Constants for nod/shake logic
  const REQUIRED_GESTURE_FRAMES = 6;
  const GESTURE_COOLDOWN_MS = 4000; 
  const GESTURE_CONFIDENCE_THRESHOLD = 0.7; 
  const NOD_THRESHOLD = 0.05;
  const SHAKE_THRESHOLD = 0.06;

  // --------------------------------------------------------------------------------
  // 2) HELPER: COMPUTE FACE RECT
  //    Moved above onResults so we can reference it in a stable manner
  // --------------------------------------------------------------------------------
  const computeFaceRect = useCallback(
    (landmarks: any[], width: number, height: number) => {
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
    },
    []
  );

  // --------------------------------------------------------------------------------
  // 3) HELPER: DETECT GESTURE (NOD/SHAKE) FROM LANDMARKS
  // --------------------------------------------------------------------------------
  const detectGestureFromLandmarks = useCallback(
    (landmarks: any[]): GestureDetection | null => {
      // We use landmark #4 for the nose tip
      const noseTip = landmarks[4];
      if (!noseTip) return null;

      const currentPos = { x: noseTip.x, y: noseTip.y };
      if (!previousNosePositionRef.current) {
        // First time seeing nose -> just store it
        previousNosePositionRef.current = currentPos;
        return null;
      }

      // Calculate delta
      const deltaX = Math.abs(currentPos.x - previousNosePositionRef.current.x);
      const deltaY = Math.abs(currentPos.y - previousNosePositionRef.current.y);
      previousNosePositionRef.current = currentPos;

      let gesture: 'yes' | 'no' | null = null;
      let confidence = 0;

      // Horizontal -> "no"
      if (deltaX > SHAKE_THRESHOLD && deltaX > deltaY * 1.2) {
        gesture = 'no';
        confidence = Math.min(deltaX / (SHAKE_THRESHOLD * 2), 1);
      }
      // Vertical -> "yes"
      else if (deltaY > NOD_THRESHOLD && deltaY > deltaX * 1.2) {
        gesture = 'yes';
        confidence = Math.min(deltaY / (NOD_THRESHOLD * 2), 1);
      }

      if (gesture && confidence > GESTURE_CONFIDENCE_THRESHOLD) {
        return { gesture, confidence, deltaX, deltaY };
      }
      return { gesture: null, confidence, deltaX, deltaY };
    },
    []
  );

  // --------------------------------------------------------------------------------
  // 4) HELPER: PROCESS GESTURE HISTORY
  // --------------------------------------------------------------------------------
  const processGestureHistory = useCallback(() => {
    const len = gestureHistoryRef.current.length;
    if (len === 0) {
      // If we were in "preparing" state but got no frames, reset
      if (preparingRef.current) {
        preparingRef.current = false;
        setResult((prev) => ({ ...prev, isPreparing: false }));
      }
      return;
    }

    const recent = gestureHistoryRef.current.slice(-REQUIRED_GESTURE_FRAMES);
    const gestures = recent.map((r) => r.gesture);
    const yesCount = gestures.filter((g) => g === 'yes').length;
    const noCount = gestures.filter((g) => g === 'no').length;
    const majority = Math.max(yesCount, noCount);

    // Mark "preparing" if frames are uniform
    if (len < REQUIRED_GESTURE_FRAMES && majority === len && !preparingRef.current) {
      preparingRef.current = true;
      setResult((prev) => ({ ...prev, isPreparing: true }));
    }

    // Check if we have enough frames to confirm
    const now = performance.now();
    const timeSinceLastGesture = now - lastGestureTimeRef.current;

    if (len >= REQUIRED_GESTURE_FRAMES) {
      const avgConfidence =
        recent.reduce((sum, item) => sum + item.confidence, 0) / recent.length;
      // Only confirm if outside cooldown + high confidence
      if (
        timeSinceLastGesture > GESTURE_COOLDOWN_MS &&
        avgConfidence > GESTURE_CONFIDENCE_THRESHOLD
      ) {
        if (yesCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.9)) {
          onGestureDetected('yes');
          lastGestureTimeRef.current = now;
          gestureHistoryRef.current = [];
          preparingRef.current = false;
          setResult((prev) => ({ ...prev, isPreparing: false }));
        } else if (noCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.9)) {
          onGestureDetected('no');
          lastGestureTimeRef.current = now;
          gestureHistoryRef.current = [];
          preparingRef.current = false;
          setResult((prev) => ({ ...prev, isPreparing: false }));
        }
      }
    }

    // If we started "preparing" but now see a mixture, reset
    if (preparingRef.current && majority !== len) {
      preparingRef.current = false;
      setResult((prev) => ({ ...prev, isPreparing: false }));
    }
  }, [
    onGestureDetected,
    REQUIRED_GESTURE_FRAMES,
    GESTURE_COOLDOWN_MS,
    GESTURE_CONFIDENCE_THRESHOLD,
  ]);

  // --------------------------------------------------------------------------------
  // 5) MAIN onResults CALLBACK
  // --------------------------------------------------------------------------------
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
        setResult((prev) => ({ ...prev, fps: fpsCalc }));
      }

      // Any faces?
      if (results.multiFaceLandmarks?.length) {
        const newFaces: FaceData[] = results.multiFaceLandmarks.map(
          (landmarks: any, index: number) => {
            // DETECT GESTURE
            const gestureResult = detectGestureFromLandmarks(landmarks);
            if (gestureResult?.gesture) {
              gestureHistoryRef.current.push(gestureResult);
              // Limit memory usage
              const maxSize = REQUIRED_GESTURE_FRAMES * 2;
              if (gestureHistoryRef.current.length > maxSize) {
                gestureHistoryRef.current = gestureHistoryRef.current.slice(-maxSize);
              }
            }

            // BOUNDING BOX
            const rect = computeFaceRect(landmarks, canvas.width, canvas.height);
            const timeSinceLastGesture = now - lastGestureTimeRef.current;
            const isInCooldown = timeSinceLastGesture < GESTURE_COOLDOWN_MS;

            // Dynamic color
            let color = '#6b7280'; // Gray
            if (isInCooldown) {
              color = '#fbbf24'; // Yellow
            } else if (gestureResult?.gesture) {
              color = gestureResult.gesture === 'yes' ? '#10b981' : '#ef4444';
            }

            // Draw bounding box
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

            // Nose highlight
            const nose = landmarks[4];
            const noseX = nose.x * canvas.width;
            const noseY = nose.y * canvas.height;
            ctx.beginPath();
            ctx.arc(noseX, noseY, 5, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // If in cooldown, show a partial arc
            if (isInCooldown) {
              const cooldownProgress = timeSinceLastGesture / GESTURE_COOLDOWN_MS;
              const arcRadius = 20;
              ctx.beginPath();
              ctx.arc(
                rect.x + rect.width - 30,
                rect.y + 30,
                arcRadius,
                0,
                2 * Math.PI * cooldownProgress
              );
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 4;
              ctx.stroke();
            }

            return {
              id: index,
              landmarks,
              rect,
              gesture: gestureResult?.gesture || null,
              confidence: gestureResult?.confidence || 0,
              deltaX: gestureResult?.deltaX || 0,
              deltaY: gestureResult?.deltaY || 0,
              nose: { x: nose.x, y: nose.y },
              isInCooldown,
            };
          }
        );

        setResult((prev) => ({
          ...prev,
          faces: newFaces,
          isLoading: false,
          error: null,
        }));
        processGestureHistory();
      } else {
        // No faces
        setResult((prev) => ({ ...prev, faces: [], isLoading: false }));
      }
    },
    [
      canvasRef,
      computeFaceRect,
      detectGestureFromLandmarks,
      processGestureHistory,
      REQUIRED_GESTURE_FRAMES,
      GESTURE_COOLDOWN_MS,
    ]
  );

  // --------------------------------------------------------------------------------
  // 6) USEEFFECT: INIT FACEMESH + CAMERA
  // --------------------------------------------------------------------------------
  useEffect(() => {
    // If not enabled, shut everything down
    if (!enabled) {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
      setResult((prev) => ({ ...prev, faces: [], fps: 0, isLoading: true }));
      return;
    }

    async function initMediaPipe() {
      try {
        // Clean up old
        if (faceMeshRef.current) {
          faceMeshRef.current.close();
          faceMeshRef.current = null;
        }

        // Create new FaceMesh
        const faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMesh.setOptions({
          maxNumFaces: 4,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        faceMesh.onResults(onResults);

        faceMeshRef.current = faceMesh;

        // Start camera if videoRef available
        if (videoRef.current) {
          if (cameraRef.current) {
            cameraRef.current.stop();
            cameraRef.current = null;
          }

          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (!faceMeshRef.current || !videoRef.current) return;
              const timeNow = performance.now();
              // Throttle detection
              if (timeNow - lastDetectionTimeRef.current > DETECTION_INTERVAL) {
                lastDetectionTimeRef.current = timeNow;
                await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 480,
            height: 360,
          });
          await camera.start();
          cameraRef.current = camera;

          setResult((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error('MediaPipe initialization error:', err);
        setResult((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Failed to initialize MediaPipe FaceMesh or camera.',
        }));
      }
    }

    initMediaPipe();

    // Cleanup on unmount or enabled flips
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

  // --------------------------------------------------------------------------------
  // 7) RETURN RESULT
  // --------------------------------------------------------------------------------
  return result;
};
