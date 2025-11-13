import {
	Toast,
	ToastAction,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import React from 'react';

export function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider>
			{toasts.map(({ id, title, description, action, actionLabel, onAction, dismiss, variant, ...props }) => {
				return (
					<Toast key={id} variant={variant} {...props}>
						<div className="grid gap-1 flex-1">
							{title && <ToastTitle>{title}</ToastTitle>}
							{description && (
								<ToastDescription>{description}</ToastDescription>
							)}
						</div>
						{action || (actionLabel && onAction && (
							<ToastAction asChild altText={actionLabel}>
								<Button
									variant="outline"
									size="sm"
									onClick={onAction}
									className="h-8"
								>
									{actionLabel}
								</Button>
							</ToastAction>
						))}
						<ToastClose />
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>
	);
}
