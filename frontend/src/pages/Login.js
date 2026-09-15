import React, { useState } from 'react';
import { supabase } from '../supabase';
import Logo from '../components/Logo';

function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // Redirects to Google; session resumes on return via AuthContext
    } catch (err) {
      console.error('Sign-in error:', err?.code || err?.status, err?.message);
      setError(`Sign-in failed (${err?.code || err?.status || 'unknown'}). ${err?.message || 'Please try again.'}`);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflow: 'hidden',
      backgroundColor: '#1a1033',
    }}>
      {/* Fallback ambient background (kept subtle behind the main animation) */}
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', opacity: 0.35 }}
      >
        <source src="/Bees_honeycomb.mp4" type="video/mp4" />
      </video>
      {/* Readability overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(26,16,51,0.72) 0%, rgba(102,126,234,0.55) 50%, rgba(118,75,162,0.72) 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(6px)',
        borderRadius: '24px',
        padding: '32px 32px 36px',
        width: '100%',
        maxWidth: '460px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        textAlign: 'center'
      }}>
        {/* Login page animation — MyBeezNus.mp4 (no borders) */}
        <div style={{ marginBottom: 22 }}>
          {!videoFailed ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              controls={false}
              preload="auto"
              onError={() => setVideoFailed(true)}
              style={{ width: '100%', height: 'auto', maxHeight: 260, objectFit: 'cover', display: 'block', border: 'none', outline: 'none', boxShadow: 'none', borderRadius: 0 }}
            >
              <source src="/MyBeezNus.mp4" type="video/mp4" />
            </video>
          ) : (
            <img
              src="/Bee_Tab_Icon.gif"
              alt="MyBeezNus animation"
              onError={(e) => { e.currentTarget.src = '/Bee_Tab_Icon.jpeg'; }}
              style={{ width: '100%', height: 'auto', maxHeight: 260, objectFit: 'contain', display: 'block', border: 'none' }}
            />
          )}
        </div>

        {/* Logo / Icon */}
        <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
          <Logo size={64} radius={16} style={{ boxShadow: '0 8px 24px rgba(102,126,234,0.4)' }} />
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#2c3e50', marginBottom: '8px' }}>
          MyBeezNus Billing
        </h1>
        <p style={{ color: '#666', fontSize: '15px', marginBottom: '35px' }}>
          Simplified Tools!
        </p>

        {error && (
          <div style={{
            background: '#fdecea',
            color: '#e74c3c',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 20px',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            background: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#2c3e50',
            transition: 'all 0.3s ease',
            opacity: loading ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = '#667eea';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102,126,234,0.2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e0e0e0';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <i className="fab fa-google" aria-hidden="true"></i>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p style={{ color: '#999', fontSize: '13px', marginTop: '30px', lineHeight: '1.6' }}>
          By signing in, you agree to our terms of service. Your data is securely stored and isolated to your account.
        </p>
      </div>
    </div>
  );
}

export default Login;
