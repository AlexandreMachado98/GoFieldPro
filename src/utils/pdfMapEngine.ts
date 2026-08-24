import { PDFMapOverlay, CalibrationPoint } from '../types';

/**
 * Creates high-detail synthetic cartographic raster representation for georeferenced PDF map overlay
 * if a raw PDF cannot be natively rendered by web worker or as an instant raster layer.
 */
export function generateSyntheticCartographicMapDataUrl(
  title: string,
  scale: string,
  gridIntervalMeters: number = 500
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background map base (topographic parchment tone)
  ctx.fillStyle = '#f8f6f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Topographic elevation contours simulation
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#c2a68c';
  for (let r = 50; r < 600; r += 35) {
    ctx.beginPath();
    ctx.ellipse(500, 450, r, r * 0.75, Math.PI / 6, 0, 2 * Math.PI);
    ctx.stroke();
  }
  for (let r = 70; r < 500; r += 40) {
    ctx.beginPath();
    ctx.ellipse(850, 300, r * 0.8, r, Math.PI / 4, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // Hydrographic rivers (blue vectors)
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(100, 100);
  ctx.bezierCurveTo(300, 250, 450, 150, 600, 400);
  ctx.bezierCurveTo(750, 650, 900, 500, 1100, 800);
  ctx.stroke();

  // River tributaries
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(600, 400);
  ctx.quadraticCurveTo(550, 600, 450, 750);
  ctx.moveTo(900, 500);
  ctx.quadraticCurveTo(1000, 400, 1150, 420);
  ctx.stroke();

  // Vegetation / Forest Hatching
  ctx.fillStyle = 'rgba(74, 222, 128, 0.15)';
  ctx.fillRect(150, 400, 350, 300);
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 1;
  ctx.strokeRect(150, 400, 350, 300);

  // UTM coordinate grid lines
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 4]);
  for (let x = 100; x < canvas.width; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 100; y < canvas.height; y += 150) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Technical Cartographic Border & Neatline
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1e293b';
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  // Title Box / Cartographic Legend & Stamp
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(canvas.width - 380, canvas.height - 180, 320, 130);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width - 380, canvas.height - 180, 320, 130);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(title, canvas.width - 365, canvas.height - 150);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Escala: ${scale} | DATUM: SIRGAS 2000`, canvas.width - 365, canvas.height - 125);
  ctx.fillText(`Grade UTM Fuso 23S | Curvas: 20m`, canvas.width - 365, canvas.height - 105);
  ctx.fillText(`GeoField Pro GeoPDF Engine`, canvas.width - 365, canvas.height - 85);

  // North Arrow
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(100, 70);
  ctx.lineTo(90, 110);
  ctx.lineTo(100, 100);
  ctx.lineTo(110, 110);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('N', 95, 65);

  return canvas.toDataURL('image/png');
}

/**
 * Computes LatLng bounding box from Ground Control Points (GCPs)
 */
export function calculateBoundsFromGCP(
  points: CalibrationPoint[],
  defaultCenter: [number, number] = [-20.25, -46.5]
): [[number, number], [number, number]] {
  if (points.length < 2) {
    // Default fallback ±0.08 degrees around center
    return [
      [defaultCenter[0] - 0.08, defaultCenter[1] - 0.12],
      [defaultCenter[0] + 0.08, defaultCenter[1] + 0.12],
    ];
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const pt of points) {
    if (pt.geoLat < minLat) minLat = pt.geoLat;
    if (pt.geoLat > maxLat) maxLat = pt.geoLat;
    if (pt.geoLng < minLng) minLng = pt.geoLng;
    if (pt.geoLng > maxLng) maxLng = pt.geoLng;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
