import { createRoot } from 'react-dom/client';
import { OptionsApp } from '@/entrypoints/options/App';

const container = document.getElementById('root');
if (container) createRoot(container).render(<OptionsApp />);
