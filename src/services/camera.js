/**
 * Camera Service for Exam Scanning
 * Supports getUserMedia with environment facing mode, frame capture, torch/flash, and file input fallback.
 */

let activeStream = null;

export const cameraService = {
  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },

  async startCamera(videoElement) {
    if (!this.isSupported()) {
      throw new Error('Fitur kamera tidak didukung di browser ini. Gunakan unggah file.');
    }

    this.stopCamera(); // Stop any existing stream

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = activeStream;
      await videoElement.play();
      return activeStream;
    } catch (err) {
      // Fallback: try without constraints
      console.warn('Standard camera constraints failed, attempting fallback...', err);
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoElement.srcObject = activeStream;
        await videoElement.play();
        return activeStream;
      } catch (fallbackErr) {
        throw new Error('Tidak dapat mengakses kamera: ' + fallbackErr.message);
      }
    }
  },

  stopCamera() {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        track.stop();
      });
      activeStream = null;
    }
  },

  async toggleTorch(enabled) {
    if (!activeStream) return false;
    const track = activeStream.getVideoTracks()[0];
    if (!track) return false;
    const capabilities = track.getCapabilities?.() || {};
    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: enabled }]
        });
        return true;
      } catch (e) {
        console.warn('Torch constraint error:', e);
      }
    }
    return false;
  },

  captureFrame(videoElement) {
    if (!videoElement || videoElement.videoWidth === 0) {
      throw new Error('Kamera belum siap');
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve({
          blob,
          dataUrl: canvas.toDataURL('image/jpeg', 0.95),
          width: canvas.width,
          height: canvas.height
        });
      }, 'image/jpeg', 0.95);
    });
  }
};
