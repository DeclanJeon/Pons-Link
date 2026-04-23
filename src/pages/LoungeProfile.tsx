import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Camera,
  ImagePlus,
  LayoutPanelTop,
  Link2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { AccountProfile, PublicProfile } from '@/features/personal-link/types';

const LoungeProfile = () => {
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
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

  const previewName = displayName.trim() || session.displayName || '이름을 입력해 주세요';
  const previewHeadline = headline.trim() || '방문자에게 보여줄 한 줄 소개를 적어보세요.';
  const previewBio = bio.trim() || '자기소개와 응답 스타일을 정리해 두면 요청을 보내는 사람이 더 빠르게 맥락을 이해합니다.';

  const completionItems = useMemo(
    () => [displayName.trim(), headline.trim(), bio.trim(), image.trim()].filter(Boolean).length,
    [bio, displayName, headline, image],
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7fb_0%,#fff1f2_34%,#ffffff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-rose-200/70 bg-white/90 shadow-[0_24px_80px_rgba(244,114,182,0.12)]" aria-label="Profile overview">
          <div className="border-b border-rose-100/80 bg-[linear-gradient(135deg,rgba(236,72,153,0.10),rgba(249,115,22,0.08),rgba(255,255,255,0.9))] px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-600 ring-1 ring-rose-200/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  Lounge identity
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">라운지 프로필</h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                  방문자가 처음 마주하는 이름, 소개, 이미지 톤을 한 번에 정리하는 공간이다. 딱딱한 설정 화면보다,
                  실제 공개 프로필을 다듬는 작업실처럼 보이게 구성했다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[320px]">
                <div className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-rose-100">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-500">Profile score</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{completionItems}/4</p>
                  <p className="mt-1 text-xs text-slate-500">핵심 항목 완성도</p>
                </div>
                <div className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-rose-100">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-500">Visibility</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">Public-ready</p>
                  <p className="mt-1 text-xs text-slate-500">개인 링크 공개 톤 점검</p>
                </div>
                <div className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-rose-100">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-500">Response mode</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">Approve first</p>
                  <p className="mt-1 text-xs text-slate-500">요청 승인 후 일정 확정</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_320px]">
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-[28px] border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">프로필 미리보기</p>
                    <p className="text-xs text-slate-500">지금 저장하면 공개 링크에서 이렇게 보인다.</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-4 rounded-[24px] bg-rose-50/70 p-4 ring-1 ring-rose-100/80">
                  {image ? (
                    <img src={image} alt="profile" className="h-20 w-20 rounded-3xl object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-rose-400 ring-1 ring-rose-100">
                      <Camera className="h-8 w-8" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-950">{previewName}</p>
                    <p className="mt-1 text-sm font-medium text-rose-600">{previewHeadline}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">{previewBio}</p>
              </article>

              <article className="rounded-[28px] border border-rose-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-500">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">톤 가이드</p>
                    <p className="text-xs text-slate-500">방문자가 신뢰를 느끼는 최소 기준</p>
                  </div>
                </div>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                  <li>• 이름은 실제 세션에서 불릴 호칭과 맞춰 두기</li>
                  <li>• 한 줄 소개는 요청을 걸러주는 역할까지 포함하기</li>
                  <li>• 소개문은 “무엇을 도와줄 수 있는지”가 바로 보이게 쓰기</li>
                  <li>• 이미지는 캐주얼해도 되지만, 공개 링크 톤과 충돌하지 않게 유지하기</li>
                </ul>
              </article>
            </div>

            <aside className="rounded-[28px] border border-rose-100 bg-white p-5 shadow-sm" aria-label="Profile quick links">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">빠른 이동</p>
                  <p className="text-xs text-slate-500">프로필 작업과 바로 이어지는 화면들</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Link to="/lounge" className="group rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4 transition hover:border-rose-200 hover:bg-rose-50" aria-label="라운지 홈">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">라운지 홈</p>
                      <p className="mt-1 text-xs text-slate-500">요청, 예약, 대시보드 흐름으로 돌아가기</p>
                    </div>
                    <LayoutPanelTop className="h-4 w-4 text-rose-500 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
                <Link to="/lounge/aliases" className="group rounded-2xl border border-rose-100 bg-white px-4 py-4 transition hover:border-rose-200 hover:bg-rose-50/40" aria-label="별칭 운영">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">별칭 운영</p>
                      <p className="mt-1 text-xs text-slate-500">공개 링크 slug와 노출 방식을 점검하기</p>
                    </div>
                    <Link2 className="h-4 w-4 text-rose-500 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-950 px-4 py-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">Current status</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  프로필 이미지를 포함해도 실제 저장되는 것은 계정/공개 프로필 필드뿐이다. 공개 링크의 신뢰감을 먼저 올리고,
                  세부 설정은 그 다음으로 미루는 구성이 더 효율적이다.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="rounded-[32px] border border-rose-200/70 bg-white/95 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)] sm:p-8" aria-label="Profile form">
          <div className="flex flex-col gap-2 border-b border-rose-100 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">Edit fields</p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">공개 프로필 내용을 다듬기</h2>
            <p className="text-sm leading-7 text-slate-600">
              입력 필드는 최소로 유지하고, 대신 각 필드가 공개 프로필에서 어떤 역할을 하는지 분명하게 보이도록 구성했다.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-900">이름</span>
                <span className="text-xs text-slate-500">방문자와 세션에서 그대로 불릴 이름</span>
                <input
                  className="rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="이름"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-900">한 줄 소개</span>
                <span className="text-xs text-slate-500">누가 왜 요청해야 하는지 바로 설명하는 문장</span>
                <input
                  className="rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="한 줄 소개"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-900">소개</span>
                <span className="text-xs text-slate-500">응답 범위, 강점, 기대 가능한 대화 흐름을 짧게 정리</span>
                <textarea
                  className="min-h-[180px] rounded-3xl border border-rose-200 bg-rose-50/50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="소개"
                />
              </label>
            </div>

            <div className="grid gap-4 rounded-[28px] border border-rose-100 bg-rose-50/50 p-5">
              <div>
                <p className="text-sm font-semibold text-slate-950">프로필 이미지</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">jpg, png, webp / 최대 5MB</p>
              </div>

              <div className="flex flex-col items-center rounded-[28px] border border-dashed border-rose-200 bg-white px-5 py-6 text-center">
                {image ? (
                  <img src={image} alt="profile" className="h-28 w-28 rounded-[28px] object-cover shadow-sm" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-rose-50 text-rose-400 ring-1 ring-rose-100">
                    <ImagePlus className="h-10 w-10" />
                  </div>
                )}
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                  <ImagePlus className="h-4 w-4" />
                  이미지 업로드
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleImage(event.target.files?.[0])}
                  />
                </label>
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:bg-white"
                  onClick={() => void handleDeleteImage()}
                >
                  <Trash2 className="h-4 w-4" />
                  이미지 삭제
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-rose-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {message ? <p className="text-sm text-slate-500">{message}</p> : <div />}
            <button
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
              onClick={() => void handleSave()}
            >
              <Save className="h-4 w-4" />
              저장
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoungeProfile;
