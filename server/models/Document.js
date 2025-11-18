const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  size: { 
    type: Number, 
    required: true 
  },
  type: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  // Note: MongoDB BSON document size limit is 16MB. 
  // For larger files in production, GridFS should be used.
  // This implementation uses direct Buffer storage for simplicity.
  data: { 
    type: Buffer, 
    required: true 
  }
});

module.exports = mongoose.model('Document', DocumentSchema);