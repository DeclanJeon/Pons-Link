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
    <div className="flex w-full max-w-sm items-start gap-4 rounded-2xl border border-white/[0.10] bg-[#111827]/95 p-4 text-slate-100 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur">
      <Avatar>
        <AvatarFallback className="bg-indigo-500/20 text-indigo-100">{request.fromNickname.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-semibold">{request.fromNickname}</p>
        <p className="text-sm text-slate-400">wants to relay "{request.streamMetadata.streamLabel}"</p>
        <div className="mt-4 flex gap-2">
          {/* <Button size="sm" className="flex-1" onClick={acceptViewOnly}>View only</Button> */}
          <Button size="sm" className="flex-1 bg-indigo-500 text-white hover:bg-indigo-400" onClick={acceptTakeover}>Use my slot</Button>
          <Button size="sm" variant="outline" className="flex-1 border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white" onClick={decline}>Decline</Button>
        </div>
      </div>
    </div>
  );
};
