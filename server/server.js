const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const Document = require('./models/Document');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure Multer for memory storage
// Limiting file size to 16MB to fit within MongoDB BSON limit
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pdfflow';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// API Routes

// GET /api/documents - List all documents (metadata only)
app.get('/api/documents', async (req, res) => {
  try {
    // Exclude the heavy 'data' field from the list view
    const docs = await Document.find({}, '-data').sort({ createdAt: -1 });
    
    const response = docs.map(doc => ({
      id: doc._id,
      name: doc.name,
      size: doc.size,
      type: doc.type,
      createdAt: doc.createdAt.getTime()
    }));
    
    res.json(response);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/documents - Upload a new document
app.post('/api/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const newDoc = new Document({
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      data: req.file.buffer
    });

    const savedDoc = await newDoc.save();

    res.status(201).json({
      id: savedDoc._id,
      name: savedDoc.name,
      size: savedDoc.size,
      type: savedDoc.type,
      createdAt: savedDoc.createdAt.getTime()
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
});

// GET /api/documents/:id - Get a single document with data
app.get('/api/documents/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      id: doc._id,
      name: doc.name,
      size: doc.size,
      type: doc.type,
      createdAt: doc.createdAt.getTime(),
      // Convert Buffer to base64 for safe JSON transport
      data: doc.data.toString('base64')
    });
  } catch (error) {
    console.error('Fetch document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// DELETE /api/documents/:id - Delete a document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const result = await Document.findByIdAndDelete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});