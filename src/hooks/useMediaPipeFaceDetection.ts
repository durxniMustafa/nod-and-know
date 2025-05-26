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
  enabled: boolean = true,
  drawFaceBoxes: boolean = true
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

  // Gesture detection accumulators
  const gestureHistoryRef = useRef<GestureDetection[]>([]);
  const lastGestureTimeRef = useRef(performance.now());
  const previousNosePositionRef = useRef<{ x: number; y: number } | null>(null);
  const preparingRef = useRef(false);

  // Constants
  const REQUIRED_GESTURE_FRAMES = 6;
  const GESTURE_COOLDOWN_MS = 4000;
  const GESTURE_CONFIDENCE_THRESHOLD = 0.7;
  const NOD_THRESHOLD = 0.05;
  const SHAKE_THRESHOLD = 0.06;

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
    (landmarks: any[]): GestureDetection | null => {
      const noseTip = landmarks[4];
      if (!noseTip) return null;

      const currentPos = { x: noseTip.x, y: noseTip.y };
      if (!previousNosePositionRef.current) {
        previousNosePositionRef.current = currentPos;
        return null;
      }

      const deltaX = Math.abs(currentPos.x - previousNosePositionRef.current.x);
      const deltaY = Math.abs(currentPos.y - previousNosePositionRef.current.y);
      previousNosePositionRef.current = currentPos;

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
    []
  );

  // -------------------------------
  // 3) processGestureHistory
  // -------------------------------
  const processGestureHistory = useCallback(() => {
    const len = gestureHistoryRef.current.length;
    if (len === 0) {
      if (preparingRef.current) {
        preparingRef.current = false;
        setResult(prev => ({ ...prev, isPreparing: false }));
      }
      return;
    }

    const recent = gestureHistoryRef.current.slice(-REQUIRED_GESTURE_FRAMES);
    const gestures = recent.map(r => r.gesture);
    const yesCount = gestures.filter(g => g === 'yes').length;
    const noCount = gestures.filter(g => g === 'no').length;
    const majority = Math.max(yesCount, noCount);

    // Enter "preparing" state if frames are uniform
    if (len < REQUIRED_GESTURE_FRAMES && majority === len && !preparingRef.current) {
      preparingRef.current = true;
      setResult(prev => ({ ...prev, isPreparing: true }));
    }

    // Check final confirmation
    const now = performance.now();
    const timeSinceLastGesture = now - lastGestureTimeRef.current;

    if (len >= REQUIRED_GESTURE_FRAMES) {
      const avgConfidence =
        recent.reduce((sum, item) => sum + item.confidence, 0) / recent.length;
      if (
        timeSinceLastGesture > GESTURE_COOLDOWN_MS &&
        avgConfidence > GESTURE_CONFIDENCE_THRESHOLD
      ) {
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

    // If we were "preparing" but now see conflicting frames
    if (preparingRef.current && majority !== len) {
      preparingRef.current = false;
      setResult(prev => ({ ...prev, isPreparing: false }));
    }
  }, [
    onGestureDetected,
    REQUIRED_GESTURE_FRAMES,
    GESTURE_COOLDOWN_MS,
    GESTURE_CONFIDENCE_THRESHOLD
  ]);

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
        const newFaces: FaceData[] = results.multiFaceLandmarks.map((landmarks: any, index: number) => {
          const gestureResult = detectGestureFromLandmarks(landmarks);
          if (gestureResult?.gesture) {
            gestureHistoryRef.current.push(gestureResult);
            // Limit length
            const maxSize = REQUIRED_GESTURE_FRAMES * 2;
            if (gestureHistoryRef.current.length > maxSize) {
              gestureHistoryRef.current = gestureHistoryRef.current.slice(-maxSize);
            }
          }

          const rect = computeFaceRect(landmarks, canvas.width, canvas.height);
          const timeSinceGesture = now - lastGestureTimeRef.current;
          const isInCooldown = timeSinceGesture < GESTURE_COOLDOWN_MS;

          if (drawFaceBoxes) {
            const fade = isInCooldown
              ? 1 - timeSinceGesture / GESTURE_COOLDOWN_MS
              : 1;
            let color = '128,128,128';
            if (gestureResult?.gesture === 'yes') color = '0,255,0';
            else if (gestureResult?.gesture === 'no') color = '255,0,0';

            ctx.save();
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(${color},${fade})`;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.restore();
          }

          return {
            id: index,
            landmarks,
            rect,
            gesture: gestureResult?.gesture || null,
            confidence: gestureResult?.confidence || 0,
            deltaX: gestureResult?.deltaX || 0,
            deltaY: gestureResult?.deltaY || 0,
            nose: { x: landmarks[4].x, y: landmarks[4].y },
            isInCooldown,
          };
        });

        setResult(prev => ({
          ...prev,
          faces: newFaces,
          isLoading: false,
          error: null
        }));
        processGestureHistory();
      } else {
        setResult(prev => ({ ...prev, faces: [], isLoading: false }));
      }
    },
    [
      canvasRef,
      computeFaceRect,
      detectGestureFromLandmarks,
      processGestureHistory,
      REQUIRED_GESTURE_FRAMES,
      GESTURE_COOLDOWN_MS,
      drawFaceBoxes,
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
