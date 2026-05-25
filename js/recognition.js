/**
 * recognition.js
 * Handles face recognition using face-api.js.
 */

const WEIGHTS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

export class RecognitionTracker {
  constructor() {
    this.isLoaded = false;
    this.matcher = null;
    this.knownPeople = []; // Array of { id, name, descriptor }
  }

  /**
   * Loads the models required for face recognition.
   * @param {function(string): void} onStatus
   */
  async load(onStatus) {
    const faceapi = window.faceapi;
    if (!faceapi) throw new Error('face-api.js not available');

    onStatus('Loading recognition models…');
    await Promise.all([
      faceapi.nets.faceRecognitionNet.loadFromUri(WEIGHTS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(WEIGHTS_URL),
      faceapi.nets.ssdMobilenetv1.loadFromUri(WEIGHTS_URL), // Better for recognition than TinyFaceDetector
    ]);

    this.isLoaded = true;
    onStatus('');
  }

  /**
   * Updates the internal matcher with the current list of people.
   * @param {Array} people - people from DB
   */
  updateKnownPeople(people) {
    const faceapi = window.faceapi;
    this.knownPeople = people
      .filter(p => p.faceDescriptor)
      .map(p => ({
        id: p.id,
        name: p.name,
        descriptor: new Float32Array(Array.from(p.faceDescriptor))
      }));

    if (this.knownPeople.length > 0) {
      const labeledDescriptors = this.knownPeople.map(p => 
        new faceapi.LabeledFaceDescriptors(String(p.id), [p.descriptor])
      );
      this.matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
    } else {
      this.matcher = null;
    }
  }

  /**
   * Detects faces and returns the descriptor of the largest one.
   * @param {HTMLVideoElement} videoEl
   * @returns {Promise<Float32Array|null>}
   */
  async getDescriptor(videoEl) {
    const faceapi = window.faceapi;
    if (!this.isLoaded) return null;

    try {
      // Use explicit SSD MobileNet options for better control
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      
      const detections = await faceapi
        .detectAllFaces(videoEl, options)
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      if (!detections || detections.length === 0) {
        // console.log('No faces detected in frame');
        return null;
      }

      console.log(`Detected ${detections.length} face(s)`);

      // If multiple faces, pick the one with the largest bounding box
      if (detections.length > 1) {
        detections.sort((a, b) => b.detection.box.area - a.detection.box.area);
      }
      
      return detections[0].descriptor;
    } catch (err) {
      console.error('Face detection error:', err);
      return null;
    }
  }

  /**
   * Recognizes a person from a descriptor.
   * @param {Float32Array} descriptor
   * @returns {Object|null} The person from knownPeople or null
   */
  recognize(descriptor) {
    if (!this.matcher) {
      console.log('No face matcher available (no known people with descriptors)');
      return null;
    }
    
    const match = this.matcher.findBestMatch(descriptor);
    console.log(`Recognition match: ${match.label} (dist: ${match.distance.toFixed(3)})`);
    
    if (match.label === 'unknown') return null;
    
    const personId = Number(match.label);
    const person = this.knownPeople.find(p => p.id === personId);
    
    if (person) {
      return { ...person, distance: match.distance };
    }
    return null;
  }
}
