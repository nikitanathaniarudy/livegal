/**
 * Manages the webcam stream.
 * Call start(videoEl) to begin streaming into a <video> element.
 */
export class Camera {
  constructor() {
    this.stream = null;
    this.videoEl = null;
  }

  async start(videoEl, deviceId = null) {
    this.videoEl = videoEl;
    const videoConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 320 }, height: { ideal: 240 } }
      : { width: { ideal: 320 }, height: { ideal: 240 } };
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
    videoEl.srcObject = this.stream;
    await videoEl.play();
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  get isRunning() {
    return !!this.stream;
  }
}
