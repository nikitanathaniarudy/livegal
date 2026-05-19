/**
 * CameraPanel
 *
 * Renders the live video feed from useCamera.
 * Step 3 will overlay a <canvas> here for face-api.js emotion detection.
 */
export default function CameraPanel({ videoRef, ready, interim }) {
  return (
    <div className="cam-panel">
      {/* Placeholder shown while camera is initialising */}
      {!ready && (
        <div className="cam-placeholder">
          <div className="cam-placeholder-icon">◻</div>
          <p className="cam-placeholder-text">Initialising camera...</p>
        </div>
      )}

      {/* Live feed */}
      <video
        ref={videoRef}
        className="cam-video"
        autoPlay
        muted
        playsInline
        style={{ display: ready ? 'block' : 'none' }}
      />

      {/*
        Step 3: add a canvas here for face-api.js overlays
        <canvas ref={canvasRef} className="cam-canvas" />
      */}

      {/* Corner brackets — galgame HUD aesthetic */}
      <div className="cam-corners" aria-hidden="true">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
      </div>

      {/* Interim speech shown live over the camera */}
      {interim && (
        <div className="cam-interim" role="status" aria-live="polite">
          <span className="cam-interim-label">Hearing...</span>
          {interim}
        </div>
      )}
    </div>
  )
}
