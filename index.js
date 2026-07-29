const express = require('express');
const multer = require('multer');
const { execSync } = require('child_process');
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
    fs.writeFileSync(pdfPath, req.file.buffer);

    execSync(
      `pdftoppm -jpeg -r 150 -f 1 -l 1 "${pdfPath}" "${path.join(tmpDir, "out")}"`,
      { stdio: 'pipe', timeout: 30000 }
    );

    const resultPath = path.join(tmpDir, 'out-1.jpg');
    if (!fs.existsSync(resultPath)) {
      throw new Error('pdftoppm did not produce output');
    }

    const jpeg = fs.readFileSync(resultPath);

    res.set('Content-Type', 'image/jpeg');
    res.set('X-Converted-From', 'pdf');
    res.send(jpeg);
  } catch (err) {
    console.error('Conversion failed:', err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF converter running on port ${PORT}`));
