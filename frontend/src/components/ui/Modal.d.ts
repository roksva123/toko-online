import { ReactNode } from 'react';
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
}
export declare function Modal({ isOpen, onClose, title, children, footer, size, }: ModalProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=Modal.d.ts.map