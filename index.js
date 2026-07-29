const express = require('express');
const multer = require('multer');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/convert', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');

  try {
    const fileSizeKb = Math.round(req.file.size / 1024);
    console.log(`Converting ${fileSizeKb}KB PDF: ${req.file.originalname}`);

    fs.writeFileSync(pdfPath, req.file.buffer);

    execFileSync('pdftoppm', [
      '-jpeg', '-r', '100', '-f', '1', '-l', '1',
      pdfPath, path.join(tmpDir, 'out')
    ], { stdio: 'pipe', timeout: 60000, killSignal: 'SIGKILL' });

    const resultPath = path.join(tmpDir, 'out-1.jpg');
    if (!fs.existsSync(resultPath)) {
      throw new Error('pdftoppm did not produce output');
    }

    const jpeg = fs.readFileSync(resultPath);
    console.log(`Converted OK: ${jpeg.length} bytes`);

    res.set('Content-Type', 'image/jpeg');
    res.send(jpeg);
  } catch (err) {
    console.error('Conversion failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

app.get('/health', (_req, res) => {
  try {
    execFileSync('which', ['pdftoppm'], { stdio: 'pipe' });
    res.json({ status: 'ok', pdftoppm: true });
  } catch {
    res.json({ status: 'degraded', pdftoppm: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF converter running on port ${PORT}`));
