import L from 'leaflet';

export const createPdfGridLayer = (
  pdfPage: any,
  baseViewportWidth: number,
  baseViewportHeight: number,
  maxZoom = 4
) => {
  return L.GridLayer.extend({
    options: {
      maxZoom: maxZoom,
      minZoom: -1,
      tileSize: 256,
      noWrap: true,
      bounds: [[0, 0], [baseViewportHeight, baseViewportWidth]],
    },

    initialize: function (options: any) {
      L.GridLayer.prototype.initialize.call(this, options);
    },

    createTile: function (coords: L.Coords, done: (err: any, tile: HTMLElement) => void) {
      const tile = document.createElement('canvas');
      const tileSize = this.options.tileSize as number;
      tile.width = tileSize;
      tile.height = tileSize;

      const context = tile.getContext('2d');
      if (!context) {
        done(new Error('Canvas 2D context not available'), tile);
        return tile;
      }
      
      context.fillStyle = '#f8fafc'; // light gray background for empty areas
      context.fillRect(0, 0, tileSize, tileSize);

      const zoom = coords.z;
      // In CRS.Simple, zoom 0 maps 1 pixel to 1 unit.
      // But standard GridLayer uses a base size.
      // Let's compute scale:
      const scale = Math.pow(2, zoom);

      // Coordinate mapping
      const x = coords.x * tileSize;
      const y = coords.y * tileSize;

      // Ensure we don't render way out of bounds unnecessarily
      if (x > baseViewportWidth * scale || y > baseViewportHeight * scale) {
         done(null, tile);
         return tile;
      }

      // We need to render the PDF page into this 256x256 tile.
      const viewport = pdfPage.getViewport({ 
        scale: scale, 
        offsetX: -x, 
        offsetY: -y 
      });

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        intent: 'display'
      };

      pdfPage.render(renderContext).promise.then(() => {
        done(null, tile);
      }).catch((err: any) => {
        if (err.name === 'RenderingCancelledException') {
          // Ignore cancelled renders during fast panning
          done(null, tile);
        } else {
          console.error('[PdfGridLayer] Tile render error:', err);
          done(err, tile);
        }
      });

      return tile;
    }
  });
};
