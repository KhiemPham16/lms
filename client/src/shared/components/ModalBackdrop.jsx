import { useEffect, useRef } from 'react';

import ui from '~/shared/styles/ui.module.scss';

const modalStack = [];

export function ModalBackdrop({ children, onClose }) {
    const modalToken = useRef(Symbol('modal'));
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const token = modalToken.current;
        modalStack.push(token);

        const handleKeyDown = (event) => {
            const isTopModal = modalStack[modalStack.length - 1] === token;
            if (event.key !== 'Escape' || !isTopModal) return;

            event.preventDefault();
            onCloseRef.current();
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            const index = modalStack.lastIndexOf(token);
            if (index >= 0) modalStack.splice(index, 1);
        };
    }, []);

    const handleBackdropClick = (event) => {
        const isTopModal = modalStack[modalStack.length - 1] === modalToken.current;
        if (event.target === event.currentTarget && isTopModal) onCloseRef.current();
    };

    return (
        <div className={ui.modalBackdrop} role="presentation" onClick={handleBackdropClick}>
            {children}
        </div>
    );
}
