import React from 'react';
import logoMicrotechnique from '../logo.png';

export default function Loader() {
  return (
    <div className="loader-container">
      <div className="loader-content">
        <img src={logoMicrotechnique} alt="logo" className="loader-logo" />
        <div className="loader-spinner" />
        <p className="loader-text">Loading...</p>
      </div>
    </div>
  );
}
