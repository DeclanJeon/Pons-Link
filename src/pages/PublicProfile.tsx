import { useParams } from 'react-router-dom';
import { usePublicProfile } from '@/features/personal-link/usePublicProfile';
import { useCreateRequest } from '@/features/personal-link/useCreateRequest';
import { useState } from 'react';
import type { RequestType } from '@/features/personal-link/types';

const PublicProfile = () => {
  const { slug = '' } = useParams();
  const profile = usePublicProfile(slug);
  const createRequest = useCreateRequest();
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [preferredTimeNote, setPreferredTimeNote] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('general');
  const [done, setDone] = useState(false);

  if (!profile.isLoading && !profile.data) {
    return <div className="p-6">존재하지 않는 링크입니다.</div>;
  }

  const data = profile.data;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{data?.displayName ?? '프로필'}</h1>
      {data?.profileImageUrl ? <img src={data.profileImageUrl} alt="profile" className="h-24 w-24 rounded-full object-cover" /> : null}
      <p>{data?.headline}</p>
      <p className="text-sm text-muted-foreground">{data?.bio}</p>
      {done ? <div className="rounded border p-4">요청을 보냈습니다. 이메일 안내를 확인하세요.</div> : (
        <div className="flex flex-col gap-3 rounded border p-4">
          <input className="rounded border p-2" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="이름" />
          <input className="rounded border p-2" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="이메일" />
          <select className="rounded border p-2" value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType)}>
            <option value="general">일반 문의</option>
            <option value="schedule">일정 요청</option>
            <option value="mentoring">멘토링</option>
            <option value="collab">협업</option>
          </select>
          <textarea className="rounded border p-2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="메시지" />
          <input className="rounded border p-2" value={preferredTimeNote} onChange={(e) => setPreferredTimeNote(e.target.value)} placeholder="희망 시간" />
          <button
            className="rounded bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => void createRequest.mutateAsync({ hostSlug: slug, visitorName, visitorEmail, requestType, message, preferredTimeNote }).then(() => setDone(true))}
          >
            요청 보내기
          </button>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;
