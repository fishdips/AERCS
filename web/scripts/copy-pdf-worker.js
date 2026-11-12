// pdf.js runs its parser in a Web Worker. Create React App's babel-loader rewrites any worker file
// that goes through webpack (it injects require() calls the browser cannot run), which breaks PDF
// rendering. So the worker is copied untouched into public/ and served as a plain static file.
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
const target = path.join(__dirname, '..', 'public', 'pdf.worker.min.js');

fs.copyFileSync(source, target);
