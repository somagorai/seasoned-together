// Bundled once into vendor/material-web.js (npm install && npm run vendor).
// The app loads only that bundle, so GitHub Pages needs no build step.
import '@material/web/all.js';
import { styles as typescaleStyles } from '@material/web/typography/md-typescale-styles.js';
document.adoptedStyleSheets.push(typescaleStyles.styleSheet);
