export const redactSensitiveInfo = (text) => {
  // Phone: /\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-. \s]?\d{1,4}[-. \s]?\d{1,9}/g
  const phoneRegex = /\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-. \s]?\d{1,4}[-. \s]?\d{1,9}/g;

  // Address keywords (House No, Pincode, Street) followed by numbers
  const addressRegex = /(House No|Pincode|Street)\s*[:#\-]?\s*\d+/gi;

  let redacted = text.replace(phoneRegex, '[🔒 PROTECTED PHONE]');
  redacted = redacted.replace(addressRegex, '[🔒 PROTECTED ADDRESS]');

  return redacted;
};

export const stripExifAndRedraw = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};
