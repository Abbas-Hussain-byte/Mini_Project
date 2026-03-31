import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { complaintsAPI } from '../services/api';
import { FiCamera, FiFileText, FiVideo, FiMapPin, FiUpload, FiAlertTriangle, FiCheckCircle, FiSearch } from 'react-icons/fi';

export default function SubmitComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('image_text'); // 'image_only', 'image_text'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  // Auto-detect location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toString());
          setLongitude(pos.coords.longitude.toString());
          reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        },
        () => console.log('Geolocation not available')
      );
    }
  }, []);

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`
      );
      const data = await response.json();
      if (data.display_name) {
        setAddress(data.display_name);
      }
    } catch (err) {
      console.warn('Reverse geocode failed:', err);
    }
  };

  const searchAddress = async () => {
    if (!addressSearch.trim()) return;
    setLocationLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        setLatitude(data[0].lat);
        setLongitude(data[0].lon);
        setAddress(data[0].display_name);
        setAddressSearch('');
      } else {
        setError('Location not found. Try a more specific address.');
      }
    } catch (err) {
      setError('Location search failed. Please try again.');
    }
    setLocationLoading(false);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);

    selectedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setPreviews(prev => [...prev, { type: 'image', url: ev.target.result, name: file.name }]);
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setPreviews(prev => [...prev, { type: 'video', name: file.name, size: (file.size / 1024 / 1024).toFixed(1) + ' MB' }]);
      }
    });
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!latitude || !longitude) {
        throw new Error('Please set your location using the search or auto-detect button.');
      }

      const formData = new FormData();
      formData.append('mode', mode);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('address', address);

      if (isEmergency) {
        formData.append('is_emergency', 'true');
      }

      if (mode === 'image_text') {
        if (!title) throw new Error('Title is required for Image + Text mode.');
        const finalTitle = isEmergency && !title.startsWith('[EMERGENCY]') ? `[EMERGENCY] ${title}` : title;
        formData.append('title', finalTitle);
        formData.append('description', description);
      }

      files.forEach(file => formData.append('files', file));

      if (files.length === 0 && mode === 'image_only') {
        throw new Error('Please upload at least one image for Image Only mode.');
      }

      const response = await complaintsAPI.create(formData);
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const c = result.complaint;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
        <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '16px', padding: '2.5rem', maxWidth: '520px', width: '100%', border: '1px solid rgba(46, 160, 67, 0.3)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(46, 160, 67, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.8rem' }}>
            <FiCheckCircle color="#2ea043" />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem' }}>Complaint Submitted!</h2>
          <p style={{ color: '#8b949e', marginBottom: '1.5rem' }}>{result.message}</p>

          {result.duplicate && (
            <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', marginBottom: '1rem', textAlign: 'left' }}>
              <p style={{ color: '#f59e0b', fontSize: '0.85rem', margin: 0 }}>
                ⚠️ {result.duplicate.message}
              </p>
            </div>
          )}

          {result.aiGenerated && (
            <div style={{ padding: '1rem', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '8px', marginBottom: '1rem', textAlign: 'left' }}>
              <p style={{ color: '#06b6d4', fontSize: '0.8rem', margin: '0 0 0.5rem', fontWeight: 600 }}>🤖 AI Generated:</p>
              <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: 0 }}>
                <strong>Title:</strong> {result.aiGenerated.title}<br />
                <strong>Description:</strong> {result.aiGenerated.description}
              </p>
            </div>
          )}

          <div style={{ textAlign: 'left', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Category:</strong> {c?.category?.replace(/_/g, ' ')}</p>
            <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Severity:</strong> <span style={{ color: c?.severity === 'critical' ? '#f85149' : c?.severity === 'high' ? '#f59e0b' : '#06b6d4' }}>{c?.severity}</span></p>
            <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Department:</strong> {c?.departments?.name || 'Pending assignment'}</p>
            <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Status:</strong> {c?.status?.replace(/_/g, ' ')}</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => { setResult(null); setFiles([]); setPreviews([]); setTitle(''); setDescription(''); }}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', background: 'transparent', color: '#c9d1d9', cursor: 'pointer', fontWeight: 500 }}>
              Report Another
            </button>
            <button onClick={() => navigate('/my-dashboard')}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              My Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '6rem 1rem 2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ color: '#f0f6fc', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Report a Civic Issue</h1>
        <p style={{ color: '#8b949e', marginBottom: '2rem' }}>Upload images/videos and AI will analyze automatically</p>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', background: 'rgba(22, 27, 34, 0.9)', borderRadius: '12px', padding: '4px', marginBottom: '1.5rem', border: '1px solid rgba(48, 54, 61, 0.5)' }}>
          <button type="button" onClick={() => setMode('image_only')}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem',
              background: mode === 'image_only' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
              color: mode === 'image_only' ? '#a855f7' : '#8b949e' }}>
            <FiCamera /> Image Only
          </button>
          <button type="button" onClick={() => setMode('image_text')}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem',
              background: mode === 'image_text' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: mode === 'image_text' ? '#06b6d4' : '#8b949e' }}>
            <FiFileText /> Image + Text
          </button>
        </div>

        {mode === 'image_only' && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <p style={{ color: '#a855f7', fontSize: '0.8rem', margin: 0 }}>📷 <strong>Image Only Mode:</strong> Just upload photos/videos — AI will auto-detect the issue, generate a title, and assign it to the right department.</p>
          </div>
        )}

        {/* 🆘 Emergency Toggle */}
        <div style={{ padding: '0.75rem 1rem', background: isEmergency ? 'rgba(248, 81, 73, 0.1)' : 'rgba(22, 27, 34, 0.5)', border: `1px solid ${isEmergency ? 'rgba(248, 81, 73, 0.4)' : 'rgba(48, 54, 61, 0.5)'}`, borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.3s' }}
          onClick={() => setIsEmergency(!isEmergency)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>{isEmergency ? '🚨' : '🆘'}</span>
            <div>
              <p style={{ color: isEmergency ? '#f85149' : '#c9d1d9', fontSize: '0.85rem', margin: 0, fontWeight: 600 }}>
                Emergency / Life-Threatening Issue
              </p>
              <p style={{ color: '#6e7681', fontSize: '0.7rem', margin: '0.1rem 0 0' }}>
                {isEmergency ? 'This complaint will be marked CRITICAL and prioritized immediately' : 'Toggle if this is a life-threatening situation (exposed wires, collapse, flooding)'}
              </p>
            </div>
          </div>
          <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: isEmergency ? '#f85149' : 'rgba(48,54,61,0.8)', position: 'relative', transition: 'background 0.3s' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: isEmergency ? '23px' : '3px', transition: 'left 0.3s' }} />
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '8px', color: '#f85149', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <FiAlertTriangle style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* File Upload */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              📎 Upload Images / Videos {mode === 'image_only' ? '(required)' : '(optional)'}
            </label>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '2rem', borderRadius: '12px', border: '2px dashed rgba(48, 54, 61, 0.8)',
              background: 'rgba(22, 27, 34, 0.5)', cursor: 'pointer', transition: 'border-color 0.3s',
              minHeight: '120px'
            }}>
              <FiUpload size={28} color="#8b949e" />
              <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                Click to upload or drag & drop
              </p>
              <p style={{ color: '#6e7681', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                Images (JPG, PNG, WebP) • Videos (MP4, WebM, MOV) • Max 25MB
              </p>
              <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>

            {previews.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                {previews.map((preview, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(48, 54, 61, 0.5)' }}>
                    {preview.type === 'image' ? (
                      <img src={preview.url} alt="" style={{ width: '100px', height: '100px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100px', height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                        <FiVideo color="#a855f7" size={24} />
                        <span style={{ color: '#8b949e', fontSize: '0.7rem', marginTop: '0.25rem' }}>{preview.size}</span>
                      </div>
                    )}
                    <button type="button" onClick={() => removeFile(i)}
                      style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(248, 81, 73, 0.9)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              📍 Location
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '0 0.75rem' }}>
                <FiSearch color="#8b949e" size={16} />
                <input type="text" placeholder="Search address or place name..."
                  value={addressSearch} onChange={(e) => setAddressSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAddress())}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f6fc', padding: '0.75rem 0.5rem', fontSize: '0.9rem' }} />
              </div>
              <button type="button" onClick={searchAddress} disabled={locationLoading}
                style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: 'none', background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {locationLoading ? '...' : 'Search'}
              </button>
              <button type="button" onClick={() => {
                if (navigator.geolocation) {
                  setLocationLoading(true);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => { setLatitude(pos.coords.latitude.toString()); setLongitude(pos.coords.longitude.toString()); reverseGeocode(pos.coords.latitude, pos.coords.longitude); setLocationLoading(false); },
                    () => { setError('Could not get your location'); setLocationLoading(false); }
                  );
                }
              }}
                style={{ padding: '0.75rem', borderRadius: '10px', border: 'none', background: 'rgba(46, 160, 67, 0.2)', color: '#2ea043', cursor: 'pointer', fontSize: '1rem' }}>
                <FiMapPin />
              </button>
            </div>

            {address && (
              <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0.5rem 0 0', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                📍 {address}
              </p>
            )}
            {latitude && longitude && (
              <p style={{ color: '#6e7681', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                Coordinates: {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
              </p>
            )}
          </div>

          {/* Title + Description (only in image_text mode) */}
          {mode === 'image_text' && (
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Title</label>
                <input type="text" placeholder="Brief title of the issue..." value={title} onChange={(e) => setTitle(e.target.value)} required
                  style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>Description</label>
                <textarea placeholder="Describe the issue in detail..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                  style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.95rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '1rem', borderRadius: '12px', border: 'none',
              background: mode === 'image_only'
                ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
                : 'linear-gradient(135deg, #06b6d4, #0891b2)',
              color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}>
            {loading ? (
              <>⏳ Analyzing & Submitting...</>
            ) : (
              <>{mode === 'image_only' ? '📷 Submit with AI Analysis' : '📝 Submit Complaint'}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
