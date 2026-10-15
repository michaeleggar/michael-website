const FALLBACK_COLOR = "#6b90b1";

const supportsStructuredClone = typeof structuredClone === "function";

export const cloneUser = (value) =>
  supportsStructuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export const createUserId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `user_${crypto.randomUUID().slice(0, 8)}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `user_${random}`;
};

export const normalizeUser = (raw, { fallbackId } = {}) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const {
    id: rawId,
    displayName: rawDisplayName,
    color: rawColor,
    bio: rawBio,
    badges: rawBadges,
    online: rawOnline,
    hidden: rawHidden,
    avatarInitial: rawAvatarInitial,
    handle: _unusedHandle,
    role: _unusedRole,
    ...rest
  } = raw;

  let id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) id = fallbackId ?? createUserId();
  const displayName =
    typeof rawDisplayName === "string" && rawDisplayName.trim()
      ? rawDisplayName.trim()
      : "Untitled User";
  const hidden = Boolean(rawHidden);
  const online = Boolean(rawOnline);
  const color =
    typeof rawColor === "string" && rawColor.trim() ? rawColor : FALLBACK_COLOR;
  const bio =
    typeof rawBio === "string" && rawBio.trim()
      ? rawBio
      : "User bio";
  const badges = Array.isArray(rawBadges) ? rawBadges.map(String) : [];
  const avatarInitial =
    typeof rawAvatarInitial === "string" && rawAvatarInitial.trim()
      ? Array.from(rawAvatarInitial.trim())[0] ?? ""
      : "";

  return {
    ...rest,
    id,
    displayName,
    color,
    bio,
    badges,
    online,
    hidden,
    avatarInitial,
  };
};

export const createUserTemplate = () =>
  normalizeUser(
    {
      id: createUserId(),
      displayName: "New Member",
      color: FALLBACK_COLOR,
      online: false,
      bio: "",
      badges: [],
      hidden: false,
      avatarInitial: "",
    },
    {},
  );
