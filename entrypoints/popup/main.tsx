import { createRoot } from 'react-dom/client';
import { PopupApp } from '@/entrypoints/popup/App';
import './style.css';

const container = document.getElementById('root');
if (container) createRoot(container).render(<PopupApp />);
