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
        descriptor: new Float32Array(Object.values(p.faceDescriptor))
      }));

    if (this.knownPeople.length > 0) {
      const labeledDescriptors = this.knownPeople.map(p => 
        new faceapi.LabeledFaceDescriptors(String(p.id), [p.descriptor])
      );
      this.matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45); // 0.45 distance threshold (stricter)
    } else {
      this.matcher = null;
    }
  }

  /**
   * Detects a face and returns its descriptor.
   * @param {HTMLVideoElement} videoEl
   * @returns {Promise<Float32Array|null>}
   */
  async getDescriptor(videoEl) {
    const faceapi = window.faceapi;
    const detection = await faceapi
      .detectSingleFace(videoEl)
      .withFaceLandmarks()
      .withFaceDescriptor();
    
    return detection ? detection.descriptor : null;
  }

  /**
   * Recognizes a person from a descriptor.
   * @param {Float32Array} descriptor
   * @returns {Object|null} The person from knownPeople or null
   */
  recognize(descriptor) {
    if (!this.matcher) return null;
    
    const match = this.matcher.findBestMatch(descriptor);
    if (match.label === 'unknown') return null;
    
    const personId = Number(match.label);
    const person = this.knownPeople.find(p => p.id === personId);
    
    if (person) {
      return { ...person, distance: match.distance };
    }
    return null;
  }
}
