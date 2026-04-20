import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { AccountProfile, PublicProfile } from '@/features/personal-link/types';
import { validateSlug, normalizeSlug } from '@/features/personal-link/slug';

const LoungeOnboarding = () => {
  const navigate = useNavigate();
  const repository = usePersonalLinkRepository();
  const { session } = useAuthSession();
  const [displayName, setDisplayName] = useState(session?.displayName ?? '');
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [roomType, setRoomType] = useState<'audio-one-to-one' | 'video-one-to-one'>('audio-one-to-one');
  const [imagePreview, setImagePreview] = useState(session?.avatarUrl ?? '');
  const [error, setError] = useState('');

  if (!session) {
    return <div className="p-6">로그인이 필요합니다.</div>;
  }

  const handleImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지는 5MB 이하만 업로드할 수 있습니다.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('jpg, png, webp 형식만 업로드할 수 있습니다.');
      return;
    }
    const imageUrl = await repository.saveAccountProfileImage(file);
    setImagePreview(imageUrl);
  };

  const handleSubmit = async () => {
    const validationError = validateSlug(slug);
    if (validationError) {
      setError(validationError);
      return;
    }
    const accountProfile: AccountProfile = {
      userId: session.userId,
      displayName,
      statusMessage: '대화 가능',
      profileImageUrl: imagePreview || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const publicProfile: PublicProfile = {
      userId: session.userId,
      slug: normalizeSlug(slug),
      headline,
      bio,
      responsePolicy: 'approve_before_booking',
      defaultRoomType: roomType,
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
    navigate('/lounge');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">PonsLink 라운지 시작</h1>
      <p className="text-sm text-muted-foreground">공개 링크와 프로필을 설정하고 라운지로 들어갑니다.</p>
      <input className="rounded border p-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="이름" />
      <input className="rounded border p-2" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="개인 링크 slug" />
      <input className="rounded border p-2" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="한 줄 소개" />
      <textarea className="rounded border p-2" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="소개" />
      <select className="rounded border p-2" value={roomType} onChange={(e) => setRoomType(e.target.value as 'audio-one-to-one' | 'video-one-to-one')}>
        <option value="audio-one-to-one">1:1 오디오</option>
        <option value="video-one-to-one">1:1 화상</option>
      </select>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void handleImage(e.target.files?.[0])} />
      {imagePreview ? <img src={imagePreview} alt="profile preview" className="h-24 w-24 rounded-full object-cover" /> : null}
      <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={() => void handleSubmit()}>라운지 시작하기</button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
};

export default LoungeOnboarding;
