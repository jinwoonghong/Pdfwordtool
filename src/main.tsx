import React from 'react';
import ReactDOM from 'react-dom/client';
import { PdfViewer } from './viewer/PdfViewer';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PdfViewer />
  </React.StrictMode>
);
