import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const COOL_USERNAMES = [
  'Digital Guardian',
  'Cyber Maniac',
  'Quantum Knight',
  'Byte Bandit',
  'Firewall Phantom',
  'Data Ninja',
  'Crypto Crusader',
  'Packet Paladin',
];

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
  questionId?: number,
  nodThreshold: number = 0.01, //old 0.04,
  shakeThreshold: number = 0.01, //old 0.06
  phase: 'question' | 'results' = 'question',
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
  const DETECTION_INTERVAL = 40 // ms (for ~25 FPS)

  const lastDetectionTimeRef = useRef(performance.now());

  // Face tracking for stable IDs
  const trackedFacesRef = useRef<TrackedFace[]>([]);
  const nextFaceIdRef = useRef(1);
  const usernameMapRef = useRef<Record<number, string>>({});
  const nextNameIndexRef = useRef(0);
  const FACE_TRACKING_THRESHOLD = 100 // pixels
  const FACE_TIMEOUT_MS = 2000 // Remove faces not seen for 2 seconds

  // Gesture detection accumulators per face
  const previousNosePositionRef = useRef<Record<number, { x: number; y: number }>>({});
  const gestureHistoryMapRef = useRef<Record<number, GestureDetection[]>>({});
  const lastGestureTimeMapRef = useRef<Record<number, number>>({});
  const lastGesturePerFaceRef = useRef<Record<number, 'yes' | 'no' | null>>({});
  const preparingRef = useRef(false);
  const lastConflictTimeRef = useRef(0);
  const directionChangeCountRef = useRef<Record<number, { x: number; y: number }> >({});
  const lastDirectionRef = useRef<Record<number, { x: number; y: number }>>({});
  const REQUIRED_DIRECTION_CHANGES = 2; // z.B. 2 Wechsel für eine echte Geste

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
    usernameMapRef.current = {};
    nextNameIndexRef.current = 0;
  }, [questionId]);

  // Constants
  const REQUIRED_GESTURE_FRAMES = 6;
  const GESTURE_COOLDOWN_MS = 4000;
  const GESTURE_CONFIDENCE_THRESHOLD = 0.7;

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
    trackedFacesRef.current = trackedFacesRef.current.filter(face => {
      const keep = now - face.lastSeen < FACE_TIMEOUT_MS;
      if (!keep) {
        delete usernameMapRef.current[face.id];
      }
      return keep;
    });

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
    if (!usernameMapRef.current[newFace.id]) {
      const name = COOL_USERNAMES[nextNameIndexRef.current % COOL_USERNAMES.length];
      usernameMapRef.current[newFace.id] = name;
      nextNameIndexRef.current++;
    }
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
    (landmarks: any[], faceId: number, rect: { width: number; height: number }): GestureDetection | null => {
      const noseTip = landmarks[4];
      if (!noseTip) return null;

      const currentPos = { x: noseTip.x, y: noseTip.y };
      const prevPos = previousNosePositionRef.current[faceId];
      previousNosePositionRef.current[faceId] = currentPos;
      if (!prevPos) return null;

      const deltaX = currentPos.x - prevPos.x;
      const deltaY = currentPos.y - prevPos.y;

      // Richtungswechsel zählen
      if (!lastDirectionRef.current[faceId]) {
        lastDirectionRef.current[faceId] = { x: 0, y: 0 };
        directionChangeCountRef.current[faceId] = { x: 0, y: 0 };
      }
      // Horizontal
      if (Math.sign(deltaX) !== 0 && Math.sign(deltaX) !== Math.sign(lastDirectionRef.current[faceId].x)) {
        directionChangeCountRef.current[faceId].x += 1;
        lastDirectionRef.current[faceId].x = deltaX;
      }
      // Vertikal
      if (Math.sign(deltaY) !== 0 && Math.sign(deltaY) !== Math.sign(lastDirectionRef.current[faceId].y)) {
        directionChangeCountRef.current[faceId].y += 1;
        lastDirectionRef.current[faceId].y = deltaY;
      }

      // Dynamische Thresholds wie gehabt
      const dynamicNodThreshold = nodThreshold * rect.width * 0.005;
      const dynamicShakeThreshold = shakeThreshold * rect.width * 0.005;

      let gesture: 'yes' | 'no' | null = null;
      let confidence = 0;

      // Horizontal => "no"
      if (
        Math.abs(deltaX) > dynamicShakeThreshold &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.2 &&
        directionChangeCountRef.current[faceId].x >= REQUIRED_DIRECTION_CHANGES
      ) {
        gesture = 'no';
        confidence = Math.min(Math.abs(deltaX) / (dynamicShakeThreshold * 2), 1);
        directionChangeCountRef.current[faceId].x = 0; // Reset nach Erkennung
      }
      // Vertical => "yes"
      else if (
        Math.abs(deltaY) > dynamicNodThreshold &&
        Math.abs(deltaY) > Math.abs(deltaX) * 1.2 &&
        directionChangeCountRef.current[faceId].y >= REQUIRED_DIRECTION_CHANGES
      ) {
        gesture = 'yes';
        confidence = Math.min(Math.abs(deltaY) / (dynamicNodThreshold * 2), 1);
        directionChangeCountRef.current[faceId].y = 0; // Reset nach Erkennung
      }

      if (gesture && confidence > GESTURE_CONFIDENCE_THRESHOLD) {
        return { gesture, confidence, deltaX: Math.abs(deltaX), deltaY: Math.abs(deltaY) };
      }
      return { gesture: null, confidence, deltaX: Math.abs(deltaX), deltaY: Math.abs(deltaY) };
    },
    [nodThreshold, shakeThreshold, GESTURE_CONFIDENCE_THRESHOLD]
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
          if (yesCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.8)) {
            onGestureDetected('yes', faceId);
            lastGestureTimeMapRef.current[faceId] = now;
            lastGesturePerFaceRef.current[faceId] = 'yes';
            gestureHistoryMapRef.current[faceId] = [];
            preparingRef.current = false;
            setResult(prev => ({ ...prev, isPreparing: false }));
          } else if (noCount >= Math.ceil(REQUIRED_GESTURE_FRAMES * 0.8)) {
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
          
          const gestureResult = detectGestureFromLandmarks(landmarks, faceId, computeFaceRect(landmarks, canvas.width, canvas.height));
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

        // Gruppierung der Gesichter (nur gültige Votes)
        function buildGroups(
          faces: FaceData[],
          maxGroupSize = 4
        ): Record<number, number> {
          // Nur Gesichter mit gültigem Vote aus dem Ref!
          const votedFaces = faces.filter(f => {
            const g = lastGesturePerFaceRef.current[f.id];
            return g === 'yes' || g === 'no';
          });
          const noFaces = votedFaces.filter(f => lastGesturePerFaceRef.current[f.id] === 'no');
          const yesFaces = votedFaces.filter(f => lastGesturePerFaceRef.current[f.id] === 'yes');

          // Ziel: Gruppen möglichst gleich groß, "no" gleichmäßig verteilen
          const total = votedFaces.length;
          const numGroups = Math.max(1, Math.ceil(total / maxGroupSize));
          const groups: FaceData[][] = Array.from({ length: numGroups }, () => []);

          // 1. "no"-Votes rundlaufend auf Gruppen verteilen
          let noIdx = 0;
          noFaces.forEach(face => {
            groups[noIdx % numGroups].push(face);
            noIdx++;
          });

          // 2. "yes"-Votes auffüllen, sodass Gruppen möglichst gleich groß werden
          let yesIdx = 0;
          let groupFillIdx = 0;
          while (yesIdx < yesFaces.length) {
            while (groups[groupFillIdx % numGroups].length >= maxGroupSize) {
              groupFillIdx++;
            }
            groups[groupFillIdx % numGroups].push(yesFaces[yesIdx]);
            yesIdx++;
            groupFillIdx++;
          }

          // 3. Mappe faceId → groupNummer
          const groupMap: Record<number, number> = {};
          groups.forEach((group, idx) => {
            group.forEach(face => {
              groupMap[face.id] = idx + 1; // Gruppen-Nummer ab 1
            });
          });

          return groupMap;
        }
        
        const groupMap = buildGroups(newFaces, 4);

        // Zeichnen
        newFaces.forEach(face => {
          // Kreisgröße dynamisch bestimmen
          const minRadius = 20;
          const maxRadius = 60;
          const dynamicRadius = Math.max(
            minRadius,
            Math.min(maxRadius, face.rect.width * 0.3)
          );

          // Kopf-Mitte bestimmen
          const headLandmark = face.landmarks[10] || face.landmarks[4];
          const cx = headLandmark.x * canvas.width;
          const cy = headLandmark.y * canvas.height - dynamicRadius - 15;

          const gesture = lastGesturePerFaceRef.current[face.id];

            if (phase === 'results') {
            // Nur für gültige Votes zeichnen
            if (gesture === 'yes' || gesture === 'no') {
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx, cy, dynamicRadius, 0, 2 * Math.PI);
              ctx.fillStyle = '#80319F'; // lila Kreis
              ctx.fill();
              ctx.closePath();

              ctx.font = `bold ${Math.round(dynamicRadius * 1.2)}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#fff'; // weiße Schrift
              ctx.fillText(
              groupMap[face.id] ? groupMap[face.id].toString() : '?',
              cx,
              cy + 2
              );
              ctx.restore();
            }
            // Sonst: nichts zeichnen!
            } else {
            // Nur in anderen Phasen: Haken/Kreuz/? zeichnen
            let circleColor = 'rgba(128,128,128,0.8)';
            let symbol = '?';
            if (gesture === 'yes') {
              circleColor = 'rgba(0,200,0,0.85)';
              symbol = '\u2713';
            } else if (gesture === 'no') {
              circleColor = 'rgba(200,0,0,0.85)';
              symbol = '\u2717';
            }
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, dynamicRadius, 0, 2 * Math.PI);
            ctx.fillStyle = circleColor;
            ctx.fill();
            ctx.closePath();

            ctx.font = `bold ${Math.round(dynamicRadius * 1.2)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(symbol, cx, cy + 2);
            ctx.restore();
          }
        });
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