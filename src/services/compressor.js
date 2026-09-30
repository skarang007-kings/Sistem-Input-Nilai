/**
 * Client-side Image Compressor
 * Resizes image so longest side is at most 1600px, JPEG quality 0.8
 * Outputs base64 string (without data:image/jpeg;base64, prefix or with it as needed)
 */

export async function compressImage(fileOrBlob, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses format gambar'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect-preserving dimensions
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw white background in case image has transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64Data = dataUrl.split(',')[1];
        const originalSize = fileOrBlob.size || 0;
        const compressedSize = Math.round((base64Data.length * 3) / 4);

        resolve({
          dataUrl,
          base64: base64Data,
          mimeType: 'image/jpeg',
          width,
          height,
          originalSize,
          compressedSize,
          compressionRatio: originalSize ? Math.round((1 - compressedSize / originalSize) * 100) : 0
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}
