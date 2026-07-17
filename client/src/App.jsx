import { AppRouter } from '~/app/router/AppRouter.jsx';
import { Toaster } from 'sonner';

function App() {
    return (
        <>
            <AppRouter />
            <Toaster richColors position="top-right" />
        </>
    );
}

export default App;
