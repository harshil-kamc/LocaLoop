const mongoose = require('mongoose');

const officialSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true }, // Gov given email
    password: { type: String, required: true },
    locality: { type: String, required: true },
    role: { type: String, default: 'Official' } // Default as requested
}, { timestamps: true });

module.exports = mongoose.model('Official', officialSchema);