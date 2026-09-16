import {
  ModalRoot,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalCloseTrigger,
  useOverlayState,
} from '@heroui/react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'sm' as const,
  md: 'md' as const,
  lg: 'lg' as const,
  xl: 'lg' as const,
};

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  return (
    <ModalRoot state={state}>
      <ModalBackdrop isDismissable>
        <ModalContainer size={sizeMap[size]} className={className}>
          <ModalDialog>
            <ModalHeader>
              <ModalHeading>{title}</ModalHeading>
              {description && (
                <p className="mt-1 text-body-sm text-text-secondary">{description}</p>
              )}
            </ModalHeader>
            <ModalBody className="max-h-[70vh] overflow-y-auto p-6">
              {children}
            </ModalBody>
            <ModalCloseTrigger />
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </ModalRoot>
  );
}
