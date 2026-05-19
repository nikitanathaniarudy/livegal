import io
import logging
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel
from pydub import AudioSegment
from fastapi.middleware.cors import CORSMiddleware

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model (tiny or base is best for local CPU)
MODEL_SIZE = "base"
logger.info(f"Loading Whisper model '{MODEL_SIZE}' (this may take a minute on first run)...")
# Using device="cpu" and compute_type="float32" for maximum compatibility
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="float32")
logger.info("Model loaded successfully.")

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_SIZE}

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to Whisper WebSocket")
    
    try:
        while True:
            # Receive audio chunk (bytes)
            # The client should send a complete audio file (e.g. WebM/Opus)
            data = await websocket.receive_bytes()
            if not data:
                continue
            
            try:
                # Use pydub to decode the incoming audio bytes (handles WebM, etc.)
                audio_stream = io.BytesIO(data)
                audio_segment = AudioSegment.from_file(audio_stream)
                
                # Convert to mono, 16kHz (required by Whisper)
                audio_segment = audio_segment.set_frame_rate(16000).set_channels(1)
                
                # Convert to numpy float32 normalized to [-1, 1]
                samples = np.frombuffer(audio_segment.raw_data, dtype=np.int16).astype(np.float32) / 32768.0
                
                # Transcribe with VAD filter to ignore silence
                segments, info = model.transcribe(samples, beam_size=1, vad_filter=True)
                
                text = " ".join([s.text for s in segments]).strip()
                
                if text:
                    logger.info(f"Transcribed [{info.language}]: {text}")
                    await websocket.send_json({
                        "type": "final",
                        "text": text,
                        "language": info.language,
                        "probability": info.language_probability
                    })
                else:
                    await websocket.send_json({"type": "empty"})
                    
            except Exception as e:
                logger.error(f"Error processing audio chunk: {e}")
                await websocket.send_json({"type": "error", "message": str(e)})
                
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Unexpected WebSocket error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
