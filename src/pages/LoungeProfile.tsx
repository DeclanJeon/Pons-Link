import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { AccountProfile, PublicProfile } from '@/features/personal-link/types';

const LoungeProfile = () => {
  const { session } = useAuthSession();
  const repository = usePersonalLinkRepository();
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [image, setImage] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    void repository.getAuthBootstrapProfile(session.email).then((data) => {
      setDisplayName(data.accountProfile?.displayName ?? '');
      setHeadline(data.publicProfile?.headline ?? '');
      setBio(data.publicProfile?.bio ?? '');
      setImage(data.accountProfile?.profileImageUrl ?? '');
    });
  }, [repository, session]);

  if (!session) return <Navigate to="/login" replace />;

  const handleImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage('이미지는 5MB 이하만 업로드할 수 있습니다.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('jpg, png, webp 형식만 업로드할 수 있습니다.');
      return;
    }
    const imageUrl = await repository.saveAccountProfileImage(file);
    setImage(imageUrl);
    setMessage('이미지를 업로드했습니다.');
  };

  const handleDeleteImage = async () => {
    await repository.removeAccountProfileImage();
    setImage('');
    setMessage('프로필 이미지를 삭제했습니다.');
  };

  const handleSave = async () => {
    const accountProfile: AccountProfile = {
      userId: session.userId,
      displayName,
      statusMessage: '대화 가능',
      profileImageUrl: image || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const existing = await repository.getAuthBootstrapProfile(session.email);
    const publicProfile: PublicProfile = existing.publicProfile
      ? {
          ...existing.publicProfile,
          headline,
          bio,
          updatedAt: new Date().toISOString(),
        }
      : {
          userId: session.userId,
          slug: `user-${session.userId}`,
          headline,
          bio,
          responsePolicy: 'approve_before_booking',
          defaultRoomType: 'audio-one-to-one',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          profileVisibility: 'public',
          allowGeneralRequest: true,
          allowScheduleRequest: true,
          allowMentoringRequest: true,
          allowCollabRequest: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    await repository.saveAccountProfile(accountProfile);
    await repository.savePublicProfile(publicProfile);
    setMessage('프로필을 저장했습니다.');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">라운지 프로필</h1>
      <input className="rounded border p-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="이름" />
      <input className="rounded border p-2" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="한 줄 소개" />
      <textarea className="rounded border p-2" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="소개" />
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void handleImage(e.target.files?.[0])} />
      {image ? <img src={image} alt="profile" className="h-24 w-24 rounded-full object-cover" /> : <div className="h-24 w-24 rounded-full border bg-muted" />}
      <div className="flex gap-2">
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={() => void handleSave()}>저장</button>
        <button className="rounded border px-4 py-2" onClick={() => void handleDeleteImage()}>이미지 삭제</button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
};

export default LoungeProfile;
