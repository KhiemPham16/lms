import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { BrowserRouter as Router } from 'react-router-dom';

import GlobalStyle from '~/components/GlobalStyles';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <>
        <Toaster richColors />
        <Router>
            <GlobalStyle>
                <App />
            </GlobalStyle>
        </Router>
    </>
);
