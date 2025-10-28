import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RelayRequest } from '@/stores/useRelayStore';
import { toast } from 'sonner';
import { useRelayStore } from '@/stores/useRelayStore';

interface RelayRequestToastProps {
  toastId: string | number;
  request: RelayRequest;
  onAccept?: () => void;
  onDecline?: () => void;
}

export const RelayRequestToast: React.FC<RelayRequestToastProps> = ({ toastId, request }) => {
  // const acceptViewOnly = () => {
  //   useRelayStore.getState().acceptRequestViewOnly(request.fromUserId);
  //   toast.dismiss(toastId);
  // };
  const acceptTakeover = () => {
    useRelayStore.getState().acceptRequestTakeover(request.fromUserId, request.fromNickname);
    toast.dismiss(toastId);
  };
  const decline = () => {
    toast.dismiss(toastId);
  };

  return (
    <div className="w-full max-w-sm p-4 bg-card border rounded-lg shadow-lg flex items-start gap-4">
      <Avatar>
        <AvatarFallback>{request.fromNickname.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-semibold">{request.fromNickname}</p>
        <p className="text-sm text-muted-foreground">wants to relay "{request.streamMetadata.streamLabel}"</p>
        <div className="mt-4 flex gap-2">
          {/* <Button size="sm" className="flex-1" onClick={acceptViewOnly}>View only</Button> */}
          <Button size="sm" className="flex-1" onClick={acceptTakeover}>Use my slot</Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={decline}>Decline</Button>
        </div>
      </div>
    </div>
  );
};
