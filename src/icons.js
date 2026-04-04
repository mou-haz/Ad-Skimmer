function generateIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size / 8);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏭', size / 2, size / 2);

    return canvas.toDataURL('image/png');
}

const sizes = [16, 48, 128];

sizes.forEach(size => {
    const dataUrl = generateIcon(size);
    console.log(`icon-${size}.png:`, dataUrl);

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `icon-${size}.png`;
    link.textContent = `Download icon-${size}.png`;
    document.body.appendChild(link);
    document.body.appendChild(document.createElement('br'));
});