/* The in-browser body tracker shared by the live mirror and the camera sizing: MediaPipe's pose landmarker, loaded on
   demand from our own public/mediapipe, so nothing leaves the device. */

export type PoseLandmark = { x: number; y: number; visibility?: number };
export type PoseTracker = { detectForVideo(v: HTMLVideoElement, t: number): { landmarks: PoseLandmark[][] }; close(): void };

export async function createPoseTracker(): Promise<PoseTracker> {
  const vision = await import('@mediapipe/tasks-vision');
  const files = await vision.FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const make = (delegate: 'GPU' | 'CPU') => vision.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate }, runningMode: 'VIDEO', numPoses: 1 });
  // Some phones and older laptops have no usable GPU path; the CPU one is slower but works.
  return (await make('GPU').catch(() => make('CPU'))) as unknown as PoseTracker;
}
