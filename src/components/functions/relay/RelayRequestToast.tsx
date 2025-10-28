import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RelayRequest } from '@/stores/useRelayStore';
import { toast } from 'sonner';

interface RelayRequestToastProps {
  toastId: string | number;
  request: RelayRequest;
  onAccept: () => void;
  onDecline: () => void;
}

export const RelayRequestToast: React.FC<RelayRequestToastProps> = ({ toastId, request, onAccept, onDecline }) => {
  const { fromNickname, streamMetadata } = request;

  const handleAccept = () => {
    onAccept();
    toast.dismiss(toastId);
  };

  const handleDecline = () => {
    onDecline();
    toast.dismiss(toastId);
  };

  return (
    <div className="w-full max-w-sm p-4 bg-card border rounded-lg shadow-lg flex items-start gap-4">
      <Avatar>
        <AvatarFallback>{fromNickname.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-semibold">{fromNickname}</p>
        <p className="text-sm text-muted-foreground">
          wants to relay their "{streamMetadata.streamLabel}" to you.
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleAccept}>Accept</Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleDecline}>Decline</Button>
        </div>
      </div>
    </div>
  );
};