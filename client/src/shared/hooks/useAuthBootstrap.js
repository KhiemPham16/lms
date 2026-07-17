import { useEffect } from 'react';

import { useAuthStore } from '~/shared/store/authStore.js';

export function useAuthBootstrap() {
    const bootstrapSession = useAuthStore((state) => state.bootstrapSession);
    const hasBootstrapped = useAuthStore((state) => state.hasBootstrapped);

    useEffect(() => {
        bootstrapSession();
    }, [bootstrapSession]);

    return { isBootstrapping: !hasBootstrapped };
}
