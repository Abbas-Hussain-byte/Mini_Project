import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsAPI } from '../services/api';
import { FiUpload, FiMapPin, FiSend, FiX, FiCheckCircle } from 'react-icons/fi';

const CATEGORIES = [
  { value: 'pothole', label: 'Pothole' },
  { value: 'damaged_road', label: 'Damaged Road' },
  { value: 'waterlogging', label: 'Waterlogging' },
  { value: 'littering', label: 'Littering / Garbage' },
  { value: 'fallen_trees', label: 'Fallen Trees' },
  { value: 'damaged_electric_wires', label: 'Damaged Electric Wires' },
  { value: 'broken_road_sign', label: 'Broken Road Sign' },
  { value: 'illegal_parking', label: 'Illegal Parking' },
  { value: 'vandalism', label: 'Vandalism / Graffiti' },
  { value: 'damaged_concrete', label: 'Damaged Concrete' },
  { value: 'water_supply', label: 'Water Supply Issue' },
  { value: 'drainage', label: 'Drainage / Sewage' },
  { value: 'other', label: 'Other' },
];

export default function SubmitComplaint() {
  const [form, setForm] = useState({ title: '', description: '', category: '', latitude: '', longitude: '', address: '' });
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 3);
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (idx) => {
    setImages(images.filter((_, i) => i !== idx));
    setPreviews(previews.filter((_, i) => i !== idx));
  };

  const captureLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation not supported');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm({ ...form, latitude: lat, longitude: lng });
        // Reverse geocode
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const data = await res.json();
          if (data.display_name) setForm(prev => ({ ...prev, latitude: lat, longitude: lng, address: data.display_name }));
        } catch { /* ignore */ }
        setLocating(false);
      },
      () => { setError('Location permission denied'); setLocating(false); }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.latitude || !form.longitude) return setError('Please capture your location');

    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      images.forEach(img => formData.append('images', img));

      await complaintsAPI.create(formData);
      setSuccess(true);
      setTimeout(() => navigate('/track'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit complaint');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-12 text-center animate-fade-in">
          <FiCheckCircle className="w-16 h-16 text-civic-success mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Complaint Submitted!</h2>
          <p className="text-slate-400">AI is analyzing your report. Redirecting to tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="glass-card p-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-1">Report a Civic Issue</h1>
        <p className="text-slate-400 text-sm mb-8">Upload photo, describe the problem, and our AI will analyze & route it to the right department.</p>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Upload Photos (max 3)</label>
            <div className="flex flex-wrap gap-3">
              {previews.map((src, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-civic-border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white">
                    <FiX size={12} />
                  </button>
                </div>
              ))}
              {previews.length < 3 && (
                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-civic-border hover:border-civic-accent flex flex-col items-center justify-center cursor-pointer transition-colors">
                  <FiUpload className="w-5 h-5 text-slate-500" />
                  <span className="text-xs text-slate-500 mt-1">Add</span>
                  <input type="file" accept="image/*" onChange={handleImages} multiple className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Title & Description */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Title</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required
                className="w-full px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 focus:border-civic-accent outline-none"
                placeholder="Brief summary of the issue" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Category</label>
              <select name="category" value={form.category} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white focus:border-civic-accent outline-none">
                <option value="">Auto-detect by AI</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} required rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 focus:border-civic-accent outline-none resize-none"
              placeholder="Describe the problem in detail..." />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Location</label>
            <button type="button" onClick={captureLocation} disabled={locating}
              className="flex items-center px-4 py-2.5 rounded-lg border border-civic-border text-slate-300 hover:bg-white/5 transition-all disabled:opacity-50">
              <FiMapPin className="mr-2" />
              {locating ? 'Locating...' : form.latitude ? '📍 Location Captured' : 'Capture My Location'}
            </button>
            {form.address && <p className="text-xs text-slate-400 mt-2 truncate">📍 {form.address}</p>}
            {form.latitude && (
              <p className="text-xs text-slate-500 mt-1">Lat: {form.latitude}, Lng: {form.longitude}</p>
            )}
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center py-3.5 rounded-xl bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50">
            <FiSend className="mr-2" />
            {loading ? 'Submitting & Analyzing...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
