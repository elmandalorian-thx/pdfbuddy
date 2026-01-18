const { createCanvas } = require('canvas');
const fs = require('fs');

const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#8b5cf6');

  // Rounded rectangle background
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Document icon
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const docWidth = size * 0.5;
  const docHeight = size * 0.6;
  const foldSize = size * 0.15;
  const x = (size - docWidth) / 2;
  const y = (size - docHeight) / 2;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + docWidth - foldSize, y);
  ctx.lineTo(x + docWidth, y + foldSize);
  ctx.lineTo(x + docWidth, y + docHeight);
  ctx.lineTo(x, y + docHeight);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + docWidth - foldSize, y);
  ctx.lineTo(x + docWidth - foldSize, y + foldSize);
  ctx.lineTo(x + docWidth, y + foldSize);
  ctx.stroke();

  const lineY1 = y + docHeight * 0.4;
  const lineY2 = y + docHeight * 0.6;
  const lineX1 = x + size * 0.08;
  const lineX2 = x + docWidth - size * 0.08;

  ctx.beginPath();
  ctx.moveTo(lineX1, lineY1);
  ctx.lineTo(lineX2, lineY1);
  ctx.moveTo(lineX1, lineY2);
  ctx.lineTo(lineX2 - size * 0.1, lineY2);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icon${size}.png`, buffer);
  console.log(`Created icon${size}.png`);
});
